// email.js
// Minimal email helper and template stub. Integrate a real email provider
// (SES, SendGrid, Postmark) in production.

// This file provides an async sendEmail function used by the auth module.

async function sendEmail(to, subject, html) {
  // Placeholder: log the email for now. Replace with a real transport.
  console.log(`Sending email to ${to} - subject: ${subject}`);
  console.log(html);
  // In production, implement nodemailer or provider SDK here.
  return Promise.resolve(true);
}

function welcomeTemplate({ fullName, schoolName, schoolId, appUrl }) {
  return `
    <p>Hi ${fullName},</p>
    <p>Welcome to GlobyEdu OS. Your school account for <strong>${schoolName}</strong> is now active.</p>
    <p>Your School ID is: <strong>${schoolId}</strong></p>
    <p>Use this School ID to sign in at <a href="${appUrl}/#/login">School Login</a>.</p>
    <p>If you need help, contact support@globyedu.com.</p>
  `;
}

function verificationTemplate(verificationLink) {
  return `
    <p>Please verify your account by clicking the link below:</p>
    <p><a href="${verificationLink}">Verify Email</a></p>
  `;
}

function resetTemplate(token, appUrl) {
  return `
    <p>You requested a password reset for your GlobyEdu account.</p>
    <p>Use the following link to reset your password:</p>
    <p><a href="${appUrl}/#/reset-password?token=${token}">Reset Password</a></p>
    <p>If you did not request this, ignore this message.</p>
  `;
}

module.exports = { sendEmail, verificationTemplate, resetTemplate, welcomeTemplate };
