// Account emails (password reset codes) sent through Resend's HTTP API
// (https://resend.com/docs). Configured with AVALEN_EMAIL_API_KEY and AVALEN_EMAIL_FROM,
// e.g. "Avalen <no-reply@yourdomain.com>" on a domain verified in Resend. Without them
// the server can't send email, and the app doesn't offer password reset.
export function emailService({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const key = env.AVALEN_EMAIL_API_KEY, from = env.AVALEN_EMAIL_FROM;
  const configured = Boolean(key && from);
  return {
    configured,
    async send({ to, subject, text, html }) {
      if (!configured) throw Object.assign(new Error("Email isn’t set up on this server."), { status: 503 });
      let res;
      try {
        res = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [to], subject, text, html }),
          signal: AbortSignal.timeout(10000),
        });
      } catch (e) {
        throw new Error(`The email service could not be reached: ${e.message}`);
      }
      if (!res.ok) throw new Error(`The email service refused the message (${res.status}).`);
    },
  };
}

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const page = (lines) => `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:16px;line-height:1.5;color:#111">${lines.join("")}</div>`;

// English first, then Arabic: the server doesn't know which language the person uses.
export function resetCodeEmail(code) {
  return {
    subject: "Your Avalen password reset code",
    text: [
      `Your Avalen code is ${code}.`,
      "Enter it in the app to choose a new password. It works for 15 minutes.",
      "If you didn't ask to reset your password, ignore this email; your password stays the same.",
      "",
      `رمزك في Avalen هو ${code}.`,
      "أدخله في التطبيق لاختيار كلمة مرور جديدة. يعمل الرمز لمدة 15 دقيقة.",
      "إذا لم تطلب إعادة تعيين كلمة المرور، فتجاهل هذه الرسالة؛ تبقى كلمة مرورك كما هي.",
    ].join("\n"),
    html: page([
      `<p>Your Avalen code is</p><p style="font-size:32px;font-weight:600;letter-spacing:6px;margin:8px 0">${escape(code)}</p>`,
      "<p>Enter it in the app to choose a new password. It works for 15 minutes.</p>",
      "<p style=\"color:#555\">If you didn't ask to reset your password, ignore this email; your password stays the same.</p>",
      `<hr style="border:0;border-top:1px solid #ddd;margin:24px 0"><div dir="rtl"><p>رمزك في Avalen هو <b>${escape(code)}</b>.</p><p>أدخله في التطبيق لاختيار كلمة مرور جديدة. يعمل الرمز لمدة 15 دقيقة.</p><p style="color:#555">إذا لم تطلب إعادة تعيين كلمة المرور، فتجاهل هذه الرسالة؛ تبقى كلمة مرورك كما هي.</p></div>`,
    ]),
  };
}

export function passwordChangedEmail() {
  return {
    subject: "Your Avalen password was changed",
    text: [
      "The password for your Avalen account was just changed, and you were signed out on your other devices.",
      "If this wasn't you, contact Avalen support right away from the Help & support page in the app.",
      "",
      "تم تغيير كلمة مرور حسابك في Avalen للتو، وتم تسجيل خروجك من أجهزتك الأخرى.",
      "إذا لم تكن أنت من قام بذلك، فتواصل مع دعم Avalen فورًا من صفحة المساعدة والدعم في التطبيق.",
    ].join("\n"),
    html: page([
      "<p>The password for your Avalen account was just changed, and you were signed out on your other devices.</p>",
      "<p>If this wasn't you, contact Avalen support right away from the Help & support page in the app.</p>",
      '<hr style="border:0;border-top:1px solid #ddd;margin:24px 0"><div dir="rtl"><p>تم تغيير كلمة مرور حسابك في Avalen للتو، وتم تسجيل خروجك من أجهزتك الأخرى.</p><p>إذا لم تكن أنت من قام بذلك، فتواصل مع دعم Avalen فورًا من صفحة المساعدة والدعم في التطبيق.</p></div>',
    ]),
  };
}
