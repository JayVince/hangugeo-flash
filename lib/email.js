/**
 * Envoi d'e-mails via SMTP (nodemailer). Configuration via variables
 * d'environnement — voir .env.example. Chez Hostinger, utilisez les
 * identifiants SMTP d'une boîte mail créée dans hPanel → E-mails.
 */
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST) {
    console.warn('⚠ SMTP non configuré — les e-mails ne seront pas envoyés (voir .env.example).');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: Number(process.env.SMTP_PORT) !== 587, // 465 = SSL direct, 587 = STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  return transporter;
}

async function sendPasswordResetEmail(toEmail, resetUrl) {
  const t = getTransporter();
  if (!t) {
    // En l'absence de SMTP configuré (ex. environnement de développement),
    // on affiche le lien dans la console plutôt que de planter.
    console.log(`[E-MAIL NON ENVOYÉ — SMTP absent] Lien de réinitialisation pour ${toEmail} : ${resetUrl}`);
    return;
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: '한국어 Flash — Réinitialisation de votre mot de passe',
    text: `Vous avez demandé à réinitialiser votre mot de passe.\n\nCliquez sur ce lien (valable 1 heure) :\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#D64E6E;">한국어 Flash</h2>
        <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
        <p>
          <a href="${resetUrl}" style="background:#D64E6E;color:#fff;padding:12px 24px;
             border-radius:50px;text-decoration:none;display:inline-block;">
            Réinitialiser mon mot de passe
          </a>
        </p>
        <p style="color:#8A8A9A;font-size:13px;">
          Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette
          demande, vous pouvez ignorer cet e-mail sans risque.
        </p>
      </div>`,
  });
}

module.exports = { sendPasswordResetEmail };
