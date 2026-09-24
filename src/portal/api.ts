import { QueryClient } from '@tanstack/react-query'

/* ---------------------------------------------------------------------------
   The portals' one way to reach the API.

   - Always same-origin (/api, proxied to server/ by Vite in development), so
     the httpOnly session cookies ride along and nothing reads a token.
   - Every request carries X-Requested-With: aa, which the server's CSRF guard
     requires on anything that changes state.
   - A failure is thrown as ApiError with the server's message and, for a
     form, its per-field messages — `err.fields.email` is what goes under the
     email box.
   - A 401 tells whoever is listening (the portal shell) that the session has
     gone, so it can send the person back to sign in with where they were.
--------------------------------------------------------------------------- */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message)
  }
}

type Params = Record<string, string | number | boolean | null | undefined | string[]>

export function qs(params?: Params) {
  if (!params) return ''
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue
    u.set(k, Array.isArray(v) ? v.join(',') : String(v))
  }
  const s = u.toString()
  return s ? `?${s}` : ''
}

const unauthorised = new Set<() => void>()
export const onUnauthorised = (fn: () => void) => {
  unauthorised.add(fn)
  return () => void unauthorised.delete(fn)
}

async function request<T>(method: string, path: string, body?: unknown, params?: Params): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  const res = await fetch(`/api${path}${qs(params)}`, {
    method,
    credentials: 'same-origin',
    headers: {
      'X-Requested-With': 'aa',
      ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  })
  if (res.status === 204) return undefined as T
  const type = res.headers.get('content-type') ?? ''
  const data = type.includes('application/json') ? await res.json().catch(() => null) : null
  if (!res.ok) {
    if (res.status === 401) unauthorised.forEach((fn) => fn())
    const err = (data as { error?: { message?: string; fields?: Record<string, string> } } | null)?.error
    throw new ApiError(res.status, err?.message ?? `Something went wrong (${res.status}).`, err?.fields ?? {})
  }
  return data as T
}

export const api = {
  get: <T>(path: string, params?: Params) => request<T>('GET', path, undefined, params),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, form),
}

/** A file from the API (CSV, PDF) saved to the person's machine. The session
 *  cookie authorises it like any other request. */
export async function download(path: string, params?: Params, fallbackName = 'download') {
  const res = await fetch(`/api${path}${qs(params)}`, { credentials: 'same-origin' })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new ApiError(res.status, data?.error?.message ?? 'The file could not be downloaded.')
  }
  const blob = await res.blob()
  const cd = res.headers.get('content-disposition') ?? ''
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] ?? fallbackName
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
    mutations: { retry: false },
  },
})

export const errorMessage = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Something went wrong.'
