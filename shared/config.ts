
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("5000"),
  HOST: z.string().default("0.0.0.0"),

  // Security
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters").default("abcdefghijklmnopqrstuvwxyz123456789012345678901234567890"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters").default("abcdefghijklmnopqrstuvwxyz123456789012345678901234567890"),
  ENCRYPTION_KEY: z.string().length(32, "ENCRYPTION_KEY must be exactly 32 characters").optional(),

  // OAuth Configuration
  OAUTH_CLIENT_ID: z.string().optional(),
  OAUTH_CLIENT_SECRET: z.string().optional(),
  OAUTH_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  DB_POOL_MIN: z.string().optional(),
  DB_POOL_MAX: z.string().optional(),
  TEST_DATABASE_URL: z.string().url().optional(),

  // Email Configuration
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  EMAIL_FROM_NAME: z.string().optional(),

  // Payment Providers
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLIC_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  KOTANIPAY_API_KEY: z.string().optional(),
  KOTANIPAY_SECRET_KEY: z.string().optional(),
  KOTANIPAY_WEBHOOK_SECRET: z.string().optional(),
  MPESA_CONSUMER_KEY: z.string().optional(),
  MPESA_CONSUMER_SECRET: z.string().optional(),
  MPESA_PASSKEY: z.string().optional(),
  MPESA_SHORTCODE: z.string().optional(),

  // Blockchain
  CELO_RPC_URL: z.string().url().optional(),
  CELO_ALFAJORES_RPC_URL: z.string().url().optional(),
  WALLET_PRIVATE_KEY: z.string().optional(),
  CUSD_CONTRACT_ADDRESS: z.string().optional(),

  // Security Configuration
  RATE_LIMIT_WINDOW_MS: z.string().optional(),
  RATE_LIMIT_MAX_REQUESTS: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),

  // Analytics & Monitoring
  ANALYTICS_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),

  // App Configuration
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  BACKEND_URL: z.string().url().default("http://localhost:5000"),
  API_BASE_URL: z.string().url().default("http://localhost:5000/api"),
  MAX_FILE_SIZE: z.string().optional(),
  UPLOAD_DIR: z.string().default("uploads"),

  // Notifications
  SOCKET_IO_CORS_ORIGIN: z.string().optional(),
  FIREBASE_ADMIN_SDK_PATH: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),

  // Development & Testing
  DEBUG: z.string().optional(),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  ENABLE_REQUEST_LOGGING: z.string().optional(),

  // Production Settings
  SSL_CERT_PATH: z.string().optional(),
  SSL_KEY_PATH: z.string().optional(),
  REDIS_URL: z.string().url().optional(),
  WEBHOOK_BASE_URL: z.string().url().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;

// Helper functions for typed environment access
export const isDevelopment = env.NODE_ENV === "development";
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

// Database configuration
export const dbConfig = {
  url: env.DATABASE_URL,
  poolMin: parseInt(env.DB_POOL_MIN || "2"),
  poolMax: parseInt(env.DB_POOL_MAX || "10"),
};

// Rate limiting configuration
export const rateLimitConfig = {
  windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
  maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS || "100"),
};

// CORS configuration
export const corsConfig = {
  origin: env.ALLOWED_ORIGINS?.split(",") || [env.FRONTEND_URL],
  credentials: true,
};
