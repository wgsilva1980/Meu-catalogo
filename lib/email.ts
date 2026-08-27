import nodemailer from 'nodemailer'

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null

function getTransporter() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return null

  if (!transporter) {
    transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  }
  return transporter
}

// Notificação best-effort por e-mail: nunca deve derrubar o fluxo que a
// chamou (cadastro/pedido público), então erros só vão pro log.
export async function sendNotificationEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const client = getTransporter()
  if (!client || !to) return

  try {
    await client.sendMail({ from: process.env.GMAIL_USER, to, subject, html })
  } catch (err) {
    console.error('Falha ao enviar e-mail de notificação:', err)
  }
}
