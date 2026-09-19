const express = require('express');

const router = express.Router();

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

router.post('/', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const message = String(req.body?.message || '').trim();

  if (!name || !isValidEmail(email) || !message) {
    return res.status(400).json({ status: 'error', message: 'Please provide your name, a valid email address, and a message.' });
  }

  if (name.length > 120 || email.length > 254 || message.length > 5000) {
    return res.status(400).json({ status: 'error', message: 'Please shorten your message and try again.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const toEmail = process.env.CONTACT_EMAIL;

  if (!apiKey || !fromEmail || !toEmail) {
    console.error('Contact form is missing RESEND_API_KEY, RESEND_FROM_EMAIL, or CONTACT_EMAIL.');
    return res.status(503).json({ status: 'error', message: 'The contact service is not configured yet. Please email our team directly.' });
  }

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: email,
        subject: `New GlobyEdu contact request from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
        html: `<p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
      }),
    });

    if (!resendResponse.ok) {
      const errorBody = await resendResponse.text();
      console.error('Resend contact email failed:', resendResponse.status, errorBody);
      return res.status(502).json({ status: 'error', message: 'We could not send your message right now. Please try again shortly.' });
    }

    return res.json({ status: 'ok', message: 'Thanks! Our team will follow up within one business day.' });
  } catch (error) {
    console.error('Contact form request failed:', error);
    return res.status(502).json({ status: 'error', message: 'We could not send your message right now. Please try again shortly.' });
  }
});

module.exports = router;
