import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();
// Support legacy EMAIL_* env var names (e.g. from examples) by mapping them to SMTP_* aliases
// This allows users to set either EMAIL_* or SMTP_* variables (Gmail examples use EMAIL_*)
const aliasEnvMap: Array<[string, string]> = [
  ['EMAIL_HOST', 'SMTP_HOST'],
  ['EMAIL_PORT', 'SMTP_PORT'],
  ['EMAIL_USER', 'SMTP_USER'],
  ['EMAIL_PASS', 'SMTP_PASS'],
  ['EMAIL_FROM', 'SMTP_FROM'],
  ['EMAIL_FROM_NAME', 'SMTP_FROM_NAME'],
];

for (const [src, dest] of aliasEnvMap) {
  if (process.env[src] && !process.env[dest]) {
    process.env[dest] = process.env[src];
  }
}

// Exchange configuration loader
// Load exchanges config from JSON file
// __dirname is not defined in ESM; derive it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const exchangesConfigPath = path.resolve(__dirname, "../server/exchanges.config.json");
let exchangesConfig: Record<string, any> = {};
try {
  const raw = fs.readFileSync(exchangesConfigPath, "utf-8");
  exchangesConfig = JSON.parse(raw);
} catch (err) {
  console.error("Failed to load exchanges config:", err);
}

export { exchangesConfig };

// Asset override loader (for hybrid dynamic/static asset metadata)
let assetOverrides: Record<string, any> = {};
try {
  const assetOverridePath = path.resolve(__dirname, "../server/assets.override.json");
  if (fs.existsSync(assetOverridePath)) {
    const raw = fs.readFileSync(assetOverridePath, "utf-8");
    assetOverrides = JSON.parse(raw);
  }
} catch (err) {
  console.error("Failed to load asset overrides:", err);
}

export { assetOverrides };

const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("5000"),
  HOST: z.string().default("localhost"),

  // Security
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters").default("dev-session-secret-change-in-production-min32chars"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters").default("dev-jwt-secret-change-in-production-min-32-characters"),
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
  SMTP_FROM: z.string().optional(),
  SMTP_FROM_NAME: z.string().optional(),
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

  // Blockchain & RPC URLs
  CELO_RPC_URL: z.string().url().optional(),
  CELO_ALFAJORES_RPC_URL: z.string().url().optional(),
  ETHEREUM_RPC_URL: z.string().url().optional(),
  POLYGON_RPC_URL: z.string().url().optional(),
  ARBITRUM_RPC_URL: z.string().url().optional(),
  OPTIMISM_RPC_URL: z.string().url().optional(),
  BASE_RPC_URL: z.string().url().optional(),
  WALLET_PRIVATE_KEY: z.string().optional(),
  CUSD_CONTRACT_ADDRESS: z.string().optional(),
  
  // Treasury Reconciliation
  TREASURY_RECONCILIATION_ENABLED: z.string().optional(),
  TREASURY_RECONCILIATION_INTERVAL_MS: z.string().optional(),
  TREASURY_CRITICAL_DISCREPANCY_THRESHOLD: z.string().optional(),
  TREASURY_WARNING_DISCREPANCY_THRESHOLD: z.string().optional(),

  // Security Configuration
  RATE_LIMIT_WINDOW_MS: z.string().optional(),
  RATE_LIMIT_MAX_REQUESTS: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),

  // Analytics & Monitoring
  ANALYTICS_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),

  // App Configuration
  FRONTEND_URL: z.string().default("http://localhost:5000"),
  BACKEND_URL: z.string().default("http://localhost:5000"),
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

const productionSecretChecks = () => {
  if (parsedEnv.data.NODE_ENV !== 'production') return;

  const missing: string[] = [];
  const weak: string[] = [];

  const requiredInProd = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
    'WALLET_PRIVATE_KEY',
  ] as const;

  for (const key of requiredInProd) {
    const value = (parsedEnv.data as any)[key];
    if (!value || String(value).trim().length === 0) {
      missing.push(key);
    }
  }

  if (parsedEnv.data.SESSION_SECRET?.includes('dev-session-secret-change-in-production')) {
    weak.push('SESSION_SECRET');
  }
  if (parsedEnv.data.JWT_SECRET?.includes('dev-jwt-secret-change-in-production')) {
    weak.push('JWT_SECRET');
  }

  if (missing.length > 0 || weak.length > 0) {
    console.error('❌ Production environment validation failed.');
    if (missing.length > 0) {
      console.error(`Missing required secrets: ${missing.join(', ')}`);
    }
    if (weak.length > 0) {
      console.error(`Weak/default secret values detected: ${weak.join(', ')}`);
    }
    process.exit(1);
  }
};

productionSecretChecks();

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

// Blockchain RPC URLs
export const blockchainRPCUrls = {
  ethereum: env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
  polygon: env.POLYGON_RPC_URL || 'https://polygon-mainnet.g.alchemy.com/v2/demo',
  arbitrum: env.ARBITRUM_RPC_URL || 'https://arb-mainnet.g.alchemy.com/v2/demo',
  optimism: env.OPTIMISM_RPC_URL || 'https://opt-mainnet.g.alchemy.com/v2/demo',
  base: env.BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/demo',
  celo: env.CELO_RPC_URL || 'https://forno.celo.org',
  celoAlfajores: env.CELO_ALFAJORES_RPC_URL || 'https://alfajores-forno.celo-testnet.org',
};

// Treasury reconciliation configuration
export const treasuryReconciliationConfig = {
  enabled: env.TREASURY_RECONCILIATION_ENABLED === 'true',
  intervalMs: parseInt(env.TREASURY_RECONCILIATION_INTERVAL_MS || '3600000'), // Default 1 hour
  criticalDiscrepancyThreshold: parseFloat(env.TREASURY_CRITICAL_DISCREPANCY_THRESHOLD || '0.05'), // 5%
  warningDiscrepancyThreshold: parseFloat(env.TREASURY_WARNING_DISCREPANCY_THRESHOLD || '0.01'), // 1%
};

// ========================================
// FEATURE FLAGS FOR PROGRESSIVE RELEASES
// ========================================
// These control which features are visible to users
// Update via .env.phases file during each phase release

export const featureFlags = {
  // ========================================
  // PHASE 1: CORE PLATFORM (Dec 1 - Jan 15)
  // ========================================
  daos: process.env.FEATURE_DAOS === "true",
  governance: process.env.FEATURE_GOVERNANCE === "true",
  treasury: process.env.FEATURE_TREASURY === "true",
  members: process.env.FEATURE_MEMBERS === "true",
  proposals: process.env.FEATURE_PROPOSALS === "true",
  voting: process.env.FEATURE_VOTING === "true",
  wallet: process.env.FEATURE_WALLET === "true",
  tasks: process.env.FEATURE_TASKS === "true",
  referrals: process.env.FEATURE_REFERRALS === "true",

  // ========================================
  // PHASE 2: CAPITAL FEATURES (Jan 15 - Mar 1)
  // ========================================
  lockedSavings: process.env.FEATURE_LOCKED_SAVINGS === "true",
  investmentPools: process.env.FEATURE_INVESTMENT_POOLS === "true",
  vaultYield: process.env.FEATURE_VAULT_YIELD === "true",

  // ========================================
  // PHASE 3: AI & ANALYTICS (Mar 1 - Apr 15)
  // ========================================
  aiAssistant: process.env.FEATURE_AI_ASSISTANT === "true",
  analytics: process.env.FEATURE_ADVANCED_ANALYTICS === "true",
  predictions: process.env.FEATURE_PREDICTIONS === "true",

  // ========================================
  // PHASE 4: GOVERNANCE EVOLUTION (Apr 15 - Jun 1)
  // ========================================
  elderCouncil: process.env.FEATURE_ELDER_COUNCIL === "true",
  escrow: process.env.FEATURE_ESCROW === "true",

  // ========================================
  // PHASE 5: MULTI-CHAIN & SCALE (Jun 1 - Aug 1)
  // ========================================
  multiChain: process.env.FEATURE_MULTI_CHAIN === "true",
  crossChain: process.env.FEATURE_CROSS_CHAIN === "true",

  // ========================================
  // FUTURE FEATURES
  // ========================================
  nftMarketplace: process.env.FEATURE_NFT_MARKETPLACE === "true",
  advancedGovernance: process.env.FEATURE_ADVANCED_GOVERNANCE === "true",
  defiIntegration: process.env.FEATURE_DeFi_INTEGRATION === "true",
};

// Beta testing flag
export const betaAccessEnabled = process.env.ENABLE_BETA_ACCESS === "true";
export const betaTesterGroup = process.env.BETA_TESTER_GROUP || "dev";

export const config = {
  // Server Configuration
  PORT: process.env.PORT || 5000,
  HOST: "localhost",
  NODE_ENV: process.env.NODE_ENV || "development",

  // Frontend URL - dynamically set based on environment
  FRONTEND_URL: process.env.REPL_SLUG 
    ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
    : process.env.FRONTEND_URL || "http://localhost:5000",

  // Backend URL - same server in this setup
  BACKEND_URL: process.env.BACKEND_URL || process.env.REPL_SLUG 
    ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
    : "http://localhost:5000",
};