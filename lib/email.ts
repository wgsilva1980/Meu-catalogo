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

// Cópia oculta em todo e-mail que o sistema manda (aviso de novo pedido,
// confirmação de pagamento, etc.) — configurável por ambiente em vez de fixa
// no código, para não expor um endereço pessoal no repositório.
const EMAIL_BCC = process.env.EMAIL_BCC?.trim() || null

// Notificação best-effort por e-mail: nunca deve derrubar o fluxo que a
// chamou (cadastro/pedido público), então erros só vão pro log.
export async function sendNotificationEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const client = getTransporter()
  if (!client) {
    // Sem isso, um GMAIL_USER/GMAIL_APP_PASSWORD faltando neste ambiente
    // (ex.: configurado só em Production, faltando em Preview) fica
    // indistinguível de "e-mail enviado" — nenhum log, nenhum erro.
    console.warn('E-mail não enviado: GMAIL_USER/GMAIL_APP_PASSWORD não configuradas neste ambiente.', { subject })
    return
  }
  if (!to) return

  try {
    const info = await client.sendMail({
      from: process.env.GMAIL_USER,
      to,
      ...(EMAIL_BCC ? { bcc: EMAIL_BCC } : {}),
      subject,
      html,
    })
    console.log('E-mail de notificação enviado:', { to, subject, messageId: info.messageId })
  } catch (err) {
    console.error('Falha ao enviar e-mail de notificação:', err)
  }
}
