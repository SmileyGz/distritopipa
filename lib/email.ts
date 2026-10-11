import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy')

export async function sendEmail({ to, subject, html }: { to: string, subject: string, html: string }) {
  if (!to) {
    console.warn('[sendEmail] Aborted: recipient email is missing')
    return { data: null, error: { message: 'Missing recipient' } }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || apiKey === 're_dummy') {
    console.warn('[sendEmail] Warning: RESEND_API_KEY is not configured or using placeholder')
  }

  try {
    const res = await resend.emails.send({
      from: 'Distrito Pipa <pedidos@distritopipa.com>',
      to: [to],
      bcc: ['smileygonla@gmail.com'],
      replyTo: 'smileygonla@gmail.com',
      subject,
      html,
    })

    if (res.error) {
      console.error(`[sendEmail] Resend API error sending to ${to}:`, JSON.stringify(res.error))
    } else {
      console.log(`[sendEmail] Email sent successfully to ${to} (id: ${res.data?.id})`)
    }

    return res
  } catch (error) {
    console.error(`[sendEmail] Exception caught sending to ${to}:`, error)
    return { data: null, error }
  }
}
