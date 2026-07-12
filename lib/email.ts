import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy')

export async function sendEmail({ to, subject, html }: { to: string, subject: string, html: string }) {
  if (!to) return null;
  try {
    const data = await resend.emails.send({
      from: 'Distrito Pipa <pedidos@distritopipa.com>',
      to: [to],
      bcc: ['pipas@distritopipa.com'],
      subject,
      html,
    })
    return data
  } catch (error) {
    console.error('Email error:', error)
    return null
  }
}
