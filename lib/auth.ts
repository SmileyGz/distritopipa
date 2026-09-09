// lib/auth.ts
// Centralized authentication and cryptographic session verification
// Compatible with both Edge Runtime and Node.js runtime.

export const ADMIN_COOKIE_NAME = 'dp_admin_session'
const SESSION_SALT = '_dp_session_salt_v1'

/**
 * Computes a cryptographic SHA-256 token from the ADMIN_SECRET and a unique salt.
 * Ensures that session cookies cannot be forged with static strings like "authenticated".
 */
export async function getExpectedAdminToken(secret: string): Promise<string> {
  if (!secret) return ''
  const encoder = new TextEncoder()
  const data = encoder.encode(`${secret}${SESSION_SALT}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Verifies if the provided token matches the expected cryptographic token for the current ADMIN_SECRET.
 */
export async function isValidAdminToken(token: string | undefined | null): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET
  if (!secret || !token) return false

  const expected = await getExpectedAdminToken(secret)
  if (!expected) return false

  // Constant-time length and value check
  if (token.length !== expected.length) return false
  let match = true
  for (let i = 0; i < expected.length; i++) {
    if (token[i] !== expected[i]) {
      match = false
    }
  }
  return match
}

/**
 * Checks if an incoming Request has a valid admin session cookie.
 */
export async function isValidAdminRequest(req: Request): Promise<boolean> {
  const cookieHeader = req.headers.get('cookie') || ''
  const cookies = cookieHeader.split(';').map(c => c.trim())
  const sessionCookie = cookies.find(c => c.startsWith(`${ADMIN_COOKIE_NAME}=`))
  
  if (!sessionCookie) return false
  const token = sessionCookie.substring(ADMIN_COOKIE_NAME.length + 1)
  return isValidAdminToken(token)
}
