import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

export async function POST(req: Request) {
  try {
    const { to, subject, html } = await req.json()
    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const data = await sendEmail({ to, subject, html })
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
