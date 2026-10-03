import { registerAs } from '@nestjs/config';

export const mailConfig = registerAs('mail', () => ({
  brevoApiKey: process.env.BREVO_API_KEY || '',
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from:
    process.env.SMTP_FROM ||
    process.env.BREVO_FROM ||
    (process.env.EMAIL_USER ? `"Connect" <${process.env.EMAIL_USER}>` : 'Connect <noreply@connect.io>'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
}));
