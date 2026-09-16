/* Inline SVGs, lifted from the prototype header. They inherit colour from the
   text around them and are sized by a className, so there is no icon library
   to install and nothing to load over the network. */

type IconProps = { className?: string }

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export function ChevronDown({ className }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true" {...stroke} strokeWidth={1.6}>
      <path d="M2 4l4 4 4-4" />
    </svg>
  )
}

export function ArrowRight({ className }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true" {...stroke} strokeWidth={1.6}>
      <path d="M2 6h8M6.6 2.6 10 6l-3.4 3.4" />
    </svg>
  )
}

export function ArrowUp({ className }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true" {...stroke} strokeWidth={1.6}>
      <path d="M6 10V2M2.6 5.4 6 2l3.4 3.4" />
    </svg>
  )
}

/* A hand holding up a heart: giving, rather than liking. The give action
   everywhere on the site carries it. Drawn after Lucide's hand-heart (ISC). */
export function HandHeart({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke} strokeWidth={2}>
      <path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16" />
      <path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" />
      <path d="m2 15 6 6" />
      <path d="M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.73 2.73 0 0 0 16 4a2.78 2.78 0 0 0-5 1.8c0 1.2.8 2 1.5 2.8L16 12Z" />
    </svg>
  )
}

export function Menu({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke} strokeWidth={1.8}>
      <path d="M3 7h18M3 12h18M3 17h18" />
    </svg>
  )
}

export function Close({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke} strokeWidth={1.8}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function Phone({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...stroke} strokeWidth={1.4}>
      <path d="M5.3 2.4 3.1 3.2c-.7.3-1.1 1-1 1.7.5 2.8 1.9 5.2 3.9 7 1.7 1.6 3.9 2.6 6.2 2.9.7.1 1.4-.4 1.6-1.1l.5-2.1-3.2-1.4-1.4 1.5C8 11 6.6 9.7 5.6 8.1L7 6.5 5.3 2.4z" />
    </svg>
  )
}

/* --- the footer set: contact, the sign-up form, back to top --- */

export function User({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...stroke} strokeWidth={1.4}>
      <circle cx="8" cy="5.4" r="2.7" />
      <path d="M2.9 13.6a5.3 5.3 0 0 1 10.2 0" />
    </svg>
  )
}

export function Mail({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...stroke} strokeWidth={1.4}>
      <rect x="1.8" y="3.2" width="12.4" height="9.6" rx="1.4" />
      <path d="m2.6 4.6 5.4 3.9 5.4-3.9" />
    </svg>
  )
}

export function MapPin({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...stroke} strokeWidth={1.4}>
      <path d="M8 14.4s4.8-4.1 4.8-7.7a4.8 4.8 0 1 0-9.6 0c0 3.6 4.8 7.7 4.8 7.7z" />
      <circle cx="8" cy="6.6" r="1.8" />
    </svg>
  )
}

export function Send({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...stroke} strokeWidth={1.4}>
      <path d="M14.4 1.6 7.2 8.8M14.4 1.6 9.8 14.4 7.2 8.8 1.6 6.2z" />
    </svg>
  )
}

export function Check({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...stroke} strokeWidth={1.8}>
      <path d="m3 8.4 3.3 3.3L13 4.6" />
    </svg>
  )
}

export function Copy({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...stroke} strokeWidth={1.5}>
      <rect x="6" y="6" width="8" height="8" rx="2" />
      <path d="M11 6V4.5A2.5 2.5 0 0 0 8.5 2h-4A2.5 2.5 0 0 0 2 4.5v4A2.5 2.5 0 0 0 4.5 11H6" />
    </svg>
  )
}

export function Lock({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...stroke} strokeWidth={1.4}>
      <rect x="3.25" y="7" width="9.5" height="6.75" rx="2" />
      <path d="M5.6 7V5.1a2.4 2.4 0 0 1 4.8 0V7" />
    </svg>
  )
}

/* --- the social marks, lifted verbatim from the prototype's sprite --- */

export function Facebook({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 6.135 4.604 11.194 10.545 11.647z" />
    </svg>
  )
}

export function Instagram({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 1 0 0-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 0 1-2.88 0 1.44 1.44 0 0 1 2.88 0z" />
    </svg>
  )
}

export function WhatsApp({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  )
}

export function YouTube({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
    </svg>
  )
}
