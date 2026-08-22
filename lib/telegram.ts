// Notificação best-effort via Telegram Bot API: nunca deve derrubar o fluxo
// que a chamou (cadastro/pedido público), então erros só vão pro log.
export async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !chatId) return

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    if (!res.ok) {
      console.error('Falha ao enviar notificação Telegram:', await res.text())
    }
  } catch (err) {
    console.error('Falha ao enviar notificação Telegram:', err)
  }
}
