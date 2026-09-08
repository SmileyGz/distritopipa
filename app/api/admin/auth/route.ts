import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    const { password } = await req.json()
    const secret = process.env.ADMIN_SECRET || process.env.NEXT_PUBLIC_ADMIN_SECRET // Fallback for backwards compatibility locally until env is updated

    if (password === secret) {
      cookies().set({
        name: 'dp_admin_session',
        value: 'authenticated',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      })
      
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Bad Request' }, { status: 400 })
  }
}
