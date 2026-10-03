import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Server
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  // Database (Supports either direct DATABASE_URL or individual DB_* params)
  DATABASE_URL: Joi.string().optional().allow(''),
  DB_HOST: Joi.string().optional().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().optional().default('postgres'),
  DB_PASSWORD: Joi.string().optional().default('postgres'),
  DB_NAME: Joi.string().optional().default('connect'),
  DB_SSL: Joi.string().valid('true', 'false', '1', '0', '').optional().allow(''),
  DB_SSL_REJECT_UNAUTHORIZED: Joi.string().valid('true', 'false', '1', '0', '').optional().allow(''),

  // Supabase (Optional metadata)
  SUPABASE_URL: Joi.string().optional().allow(''),
  SUPABASE_ANON_KEY: Joi.string().optional().allow(''),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().optional().allow(''),

  // Health Monitoring Security (Optional token for protecting health endpoint)
  HEALTH_CHECK_TOKEN: Joi.string().optional().allow(''),

  // Redis
  REDIS_URL: Joi.string().optional().allow(''),
  REDIS_HOST: Joi.string().optional().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional().allow(''),
  REDIS_TLS: Joi.string().valid('true', 'false', '1', '0', '').optional().allow(''),

  // Auth
  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_SECRET must be at least 32 characters for security',
  }),
  ACCESS_TOKEN_TTL: Joi.string().default('15m'),
  REFRESH_TOKEN_TTL: Joi.string().default('7d'),

  // Stripe (optional at boot — set when billing/webhooks are live)
  STRIPE_SECRET_KEY: Joi.string().optional().allow(''),
  STRIPE_WEBHOOK_SECRET: Joi.string().optional().allow(''),
  STRIPE_PRICE_ID_PRO: Joi.string().optional().allow(''),
  STRIPE_PRICE_ID_ENTERPRISE: Joi.string().optional().allow(''),
  FRONTEND_URL: Joi.string().default('http://localhost:3001'),

  // Email (SMTP) — env vars are strings; mail.config uses SMTP_SECURE === 'true'
  SMTP_HOST: Joi.string().optional().default('localhost'),
  SMTP_PORT: Joi.number().optional().default(587),
  SMTP_SECURE: Joi.string().valid('true', 'false', '1', '0', '').optional().allow(''),
  SMTP_USER: Joi.string().optional().allow(''),
  SMTP_PASS: Joi.string().optional().allow(''),
  SMTP_FROM: Joi.string().optional().default('Connect <noreply@connect.io>'),
});
