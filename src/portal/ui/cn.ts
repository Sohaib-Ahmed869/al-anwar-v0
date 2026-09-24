import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/* tailwind-merge has to be told about the site's own spacing scale (p-s3,
   gap-s2…), or it cannot tell that `p-s3` and `p-4` fight. */
const twMerge = extendTailwindMerge({
  extend: {
    theme: { spacing: ['s1', 's2', 's3', 's4', 's5', 's6'] },
  },
})

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))
