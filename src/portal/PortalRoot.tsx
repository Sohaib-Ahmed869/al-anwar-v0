import { useEffect, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from './api'
import { ConfirmProvider } from './ui/Dialog'

/* Everything the three portals share around their routes: the query cache,
   toasts, the confirm dialog, and the flag that gives the document its
   scrollbar back (see html[data-portal] in index.css). The public site loads
   none of this — each portal is its own lazy chunk. */
export function PortalRoot({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-portal', '')
    return () => document.documentElement.removeAttribute('data-portal')
  }, [])
  return (
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>{children}</ConfirmProvider>
      <Toaster
        position="bottom-right"
        offset={20}
        mobileOffset={{ bottom: 84 }}
        toastOptions={{
          classNames: {
            toast: '!rounded-xl !bg-ink !text-text-on-ink !border-0 !shadow-pop !font-sans !text-[13.5px]',
            description: '!text-text-on-ink-2',
            actionButton: '!bg-white/10 !text-white',
          },
        }}
      />
    </QueryClientProvider>
  )
}
