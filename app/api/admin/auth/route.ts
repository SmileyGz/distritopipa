import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE_NAME, getExpectedAdminToken } from '@/lib/auth'

// Rate limiting: max 5 login attempts per IP per 15 minutes to prevent brute-force
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 })
    return true
  }
  if (entry.count >= 5) return false
  entry.count++
  return true
}

export async function POST(req: Request) {
  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown'

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: 'Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.' },
      { status: 429 }
    )
  }

  try {
    const { password } = await req.json()
    const secret = process.env.ADMIN_SECRET

    if (secret && password === secret) {
      // Clear rate-limiting on successful login
      rateLimitMap.delete(ip)

      const token = await getExpectedAdminToken(secret)

      cookies().set({
        name: ADMIN_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      })
      
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Contraseña incorrecta' }, { status: 401 })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Bad Request' }, { status: 400 })
  }
}
