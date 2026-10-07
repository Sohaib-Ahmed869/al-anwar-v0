/* ---------------------------------------------------------------------------
   What a staff password must be. One function, read by the server (which is
   the rule) and by the sign-in pages (which only use it to say so sooner).

   Length is what matters, so the floor is 10 characters and there are no
   "one symbol, one capital" rules — a short sentence is the advice the forms
   give. The ceiling is 72 bytes because bcrypt silently ignores everything
   after that: a longer password would look accepted while only its first 72
   bytes counted. And a password everyone tries first is refused outright; the
   list is small and built in, so checking it needs no network call.
--------------------------------------------------------------------------- */

export const PASSWORD_MIN = 10
export const PASSWORD_MAX_BYTES = 72

/* the most common passwords of ten or more characters in public breach
   lists, plus the obvious ones for this organisation */
const COMMON = new Set([
  '1234567890', '0123456789', '12345678910', '1q2w3e4r5t', 'qwertyuiop', '1qaz2wsx3edc', 'qwerty1234',
  'password12', 'password123', 'password1234', 'passw0rd123', 'iloveyou12', 'abcdefghij', 'abcd123456',
  'aaaaaaaaaa', '1111111111', '0000000000', '9876543210', 'qwertyuiop123', 'zaq12wsxcde', 'letmein123',
  'welcome123', 'welcome1234', 'administrator', 'changeme123', 'football123', 'princess123', 'sunshine123',
  'trustno1234', 'computer123', 'starwars123', 'dragon12345', 'monkey12345', 'baseball123', 'superman123',
  'qwerty12345', 'asdfghjkl1', 'asdfghjkl;', 'zxcvbnm123', 'q1w2e3r4t5', '1a2b3c4d5e', 'p@ssw0rd123',
  'password!1', 'password1!', 'mypassword', 'mypassword1', 'secret1234', 'alanwaar123', 'alanwaar2026',
  'al-anwaar123', 'alanwaar-demo', 'bismillah1', 'bismillah123', 'alhamdulillah', 'mashallah123',
  'insha allah', 'inshallah123', 'subhanallah', 'allahuakbar', 'muhammad123', 'charity123', 'donation123',
])

/** Why this password can't be used, or null if it can. */
export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters`
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return 'That is too long — keep it under 72 characters'
  const p = password.trim().toLowerCase()
  if (COMMON.has(p)) return 'That password is too common. Try a short sentence instead'
  if (/^(.)\1+$/.test(p)) return 'Use something less predictable than one repeated character'
  if (email) {
    const local = email.split('@')[0].toLowerCase()
    if (p === email.toLowerCase() || (local.length >= 4 && p.replace(/[^a-z]/g, '') === local.replace(/[^a-z]/g, ''))) {
      return 'Choose something other than your email address'
    }
  }
  return null
}
