/* ---------------------------------------------------------------------------
   A tiny HTTP client for the API tests: JSON in and out, the CSRF header on
   every request (as src/portal/api.ts sends it), and a cookie jar so a
   sign-in carries over to the next call — one Client is one browser.
--------------------------------------------------------------------------- */

export type Res<T = any> = { status: number; body: T; headers: Headers; text: string }

export class Client {
  private jar = new Map<string, string>()
  constructor(readonly base: string) {}

  /** the cookies this "browser" holds, e.g. to forge or drop one */
  get cookies() {
    return this.jar
  }

  async request<T = any>(
    method: string,
    path: string,
    body?: unknown,
    opts: { headers?: Record<string, string>; csrf?: boolean; raw?: BodyInit } = {},
  ): Promise<Res<T>> {
    const headers: Record<string, string> = { ...opts.headers }
    if (opts.csrf !== false) headers['X-Requested-With'] = 'aa'
    if (body !== undefined && opts.raw === undefined) headers['Content-Type'] = 'application/json'
    if (this.jar.size) headers.Cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ')

    const res = await fetch(this.base + path, {
      method,
      headers,
      body: opts.raw ?? (body === undefined ? undefined : JSON.stringify(body)),
      redirect: 'manual',
    })
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(';')
      const i = pair.indexOf('=')
      const name = pair.slice(0, i).trim()
      const value = pair.slice(i + 1).trim()
      const expired = attrs.some((a) => /^\s*expires=Thu, 01 Jan 1970/i.test(a) || /^\s*max-age=0/i.test(a))
      if (expired || value === '') this.jar.delete(name)
      else this.jar.set(name, value)
    }
    const text = await res.text()
    let parsed: unknown = text
    try {
      parsed = text ? JSON.parse(text) : undefined
    } catch {
      /* not JSON (a CSV, an HTML page) — leave it as text */
    }
    return { status: res.status, body: parsed as T, headers: res.headers, text }
  }

  get<T = any>(path: string, opts?: Parameters<Client['request']>[3]) {
    return this.request<T>('GET', path, undefined, opts)
  }
  post<T = any>(path: string, body?: unknown, opts?: Parameters<Client['request']>[3]) {
    return this.request<T>('POST', path, body ?? {}, opts)
  }
  put<T = any>(path: string, body?: unknown, opts?: Parameters<Client['request']>[3]) {
    return this.request<T>('PUT', path, body ?? {}, opts)
  }
  patch<T = any>(path: string, body?: unknown, opts?: Parameters<Client['request']>[3]) {
    return this.request<T>('PATCH', path, body ?? {}, opts)
  }
  delete<T = any>(path: string, opts?: Parameters<Client['request']>[3]) {
    return this.request<T>('DELETE', path, undefined, opts)
  }
}
