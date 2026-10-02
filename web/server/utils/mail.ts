// Отправка писем: log (в консоль — стенд без DNS) или Unisender Go
type Mail = { to: string; subject: string; text: string; html?: string }

export async function sendMail(m: Mail) {
  const cfg = useRuntimeConfig()
  if (cfg.mailProvider !== 'unisender' || !cfg.unisenderKey) {
    console.log(`[mail] → ${m.to} · ${m.subject}\n${m.text}`)
    return { ok: true, provider: 'log' as string, error: undefined as string | undefined }
  }
  const res = await fetch(cfg.unisenderUrl + '/email/send.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': cfg.unisenderKey },
    body: JSON.stringify({
      message: {
        recipients: [{ email: m.to }],
        subject: m.subject,
        from_email: cfg.mailFrom, from_name: cfg.mailFromName,
        body: { plaintext: m.text, ...(m.html ? { html: m.html } : {}) },
        track_links: 0, track_read: 0,
      },
    }),
  })
  const j: any = await res.json().catch(() => ({}))
  const failed = j?.failed_emails && Object.keys(j.failed_emails).length ? j.failed_emails : null
  if (!res.ok || j?.status !== 'success' || failed) {
    console.error('[mail] unisender', res.status, JSON.stringify(j).slice(0, 500))
    return { ok: false, provider: 'unisender', error: failed ? JSON.stringify(failed) : (j?.message || res.status) }
  }
  return { ok: true, provider: 'unisender' }
}

const SUBJ: Record<string, string> = {
  register: 'Код подтверждения регистрации',
  login: 'Код для входа',
  reset: 'Код для восстановления пароля',
  change_email: 'Код для смены почты',
  reveal: 'Код для показа реквизитов карты',
}
export function codeMail(to: string, purpose: string, code: string): Mail {
  const subject = `${code} — ${SUBJ[purpose] || 'код Vexel'}`
  const text = `${SUBJ[purpose] || 'Код'}: ${code}\n\nКод действует 10 минут. Если вы ничего не запрашивали — просто удалите письмо.\n\nVexel`
  const html = `<div style="font:15px/1.5 Arial,sans-serif;color:#0E1420"><p>${SUBJ[purpose] || 'Код'}:</p>
<p style="font:600 28px/1 'Courier New',monospace;letter-spacing:6px;color:#0244BE">${code}</p>
<p style="color:#596070">Код действует 10 минут. Если вы ничего не запрашивали — просто удалите письмо.</p><p>Vexel</p></div>`
  return { to, subject, text, html }
}

export function resetMail(to: string, username: string, link: string): Mail {
  const text = `Восстановление пароля Vexel\n\nЛогин: ${username}\n\nЧтобы задать новый пароль, откройте ссылку (действует 30 минут, один раз):\n${link}\n\nЕсли вы не запрашивали восстановление — просто удалите письмо, пароль останется прежним.\n\nVexel`
  const html = `<div style="font:15px/1.5 Arial,sans-serif;color:#0E1420"><p><b>Восстановление пароля Vexel</b></p><p>Логин: <b>${username}</b></p>
<p><a href="${link}" style="display:inline-block;background:#0244BE;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Задать новый пароль</a></p>
<p style="color:#596070">Ссылка действует 30 минут и срабатывает один раз. Если вы не запрашивали восстановление — просто удалите письмо, пароль останется прежним.</p><p>Vexel</p></div>`
  return { to, subject: 'Восстановление пароля Vexel', text, html }
}
