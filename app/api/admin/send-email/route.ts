import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { isValidAdminRequest } from '@/lib/auth'

export async function POST(req: Request) {
  // Defense-in-Depth: Validate admin session directly inside the route handler
  const isAuthorized = await isValidAdminRequest(req)
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { to, subject, html } = await req.json()
    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const data = await sendEmail({ to, subject, html })
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
