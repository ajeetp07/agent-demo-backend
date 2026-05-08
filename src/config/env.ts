import * as dotenv from "dotenv";
import * as path from "path";
import { z } from "zod";
import { SERVER_ENV } from "@/enums";

if (process.env.NODE_ENV === SERVER_ENV.DEVELOPMENT) {
  dotenv.config({ path: path.resolve(".", ".env.development") });
} else if (process.env.NODE_ENV === SERVER_ENV.STAGING) {
  dotenv.config({ path: path.resolve(".", ".env.staging") });
} else {
  dotenv.config();
}

// Zod schema for environment variables
const envSchema = z.object({
  // Database Configuration
  DB_PATH: z.url().default("mongodb://localhost:27017/boilerplate"),
  BACKUP_PATH: z.string().optional(),
  LOCAL_DB_FILE: z.string().optional(),

  // Server Configuration
  NODE_ENV: z.enum(SERVER_ENV).default(SERVER_ENV.DEVELOPMENT),
  PORT: z.string().regex(/^\d+$/).default("8000"),
  CRON_PORT: z.string().regex(/^\d+$/).default("8001"),
  HOST: z.url().default("http://localhost:8000"),
  FRONTEND_HOST: z.url().default("http://localhost:3000"),
  FRONTEND_INVITE_URL: z.url().default("http://localhost:3000/signup"),
  JWT_SECRET: z.string().min(8).default("i am a tea pot"),
  MFA_JWT_TOKEN_SECRET: z.string().min(8).default("default-mfa-jwt-secret"),
  OTP_HASH_SECRET: z.string().min(8).default("default-otp-secret"),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),

  // Request timeout (in milliseconds)
  REQUEST_TIMEOUT: z.coerce.number().positive().default(60000),

  // Number of test data
  NUM_TEST_DATA: z.coerce.number().int().positive().default(10),

  // Twilio Keys
  TWILIO_NUMBER: z.string(),
  TWILIO_ACCOUNTSID: z.string(),
  TWILIO_AUTHTOKEN: z.string(),

  // Stripe Keys
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_ACCOUNT_ID: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  STRIPE_CONNECT_WEBHOOK_SECRET: z.string(),
  STRIPE_PAYMENT_WEBHOOK_SECRET: z.string(),

  // Amazon S3 Keys
  S3_USER_KEY: z.string(),
  S3_USER_SECRET: z.string(),
  S3_BUCKET_NAME: z.string().default("boilerplate-s3-upload"),
  S3_BUCKET_REGION: z.string().default("us-east-2"),
  AWS_LOG_GROUP_NAME: z.string().optional(),
  SES_TEST_EMAIL: z.email(),
  SES_SENDER_EMAIL: z.email(),

  // Apple Client Keys
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_ID_IOS: z.string().optional(),

  // Slack Webhook
  SLACK_WEBHOOK_FOR_LOGS: z.string().optional(),

  // Get Stream Keys
  GET_STREAM_MESSAGING_KEY: z.string(),
  GET_STREAM_MESSAGING_SECRET: z.string(),

  // Supabase Keys
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_KEY: z.string(),

  // OpenAI API keys
  OPENAI_API_KEY: z.string(),
  OPENAI_EMBEDDING_MODAL: z.string(),
  OPENAI_MODAL: z.string(),
  OPENAI_EMBEDDING_DIMENSIONS: z.coerce.number().default(1536), // this depends on the model you are using

  // Cohere client token
  COHERE_CLIENT_TOKEN: z.string().optional(),

  // Chroma DB host
  CHROMA_DB_LOCAL_HOST_URL: z.url().optional(),

  //Es client
  ELASTIC_SEARCH_HOST_URL: z.url(),
  ELASTIC_SEARCH_API_KEY: z.string(),

  // OneSignal
  ONE_SIGNAL_APP_ID: z.string(),
  ONE_SIGNAL_REST_API_KEY: z.string(),

  // Cookie
  COOKIE_DOMAIN_NAME: z.string(),

  // WorkOs authkit
  WORKOS_CLIENT_ID: z.string(),
  WORKOS_API_KEY: z.string(),
  WORKOS_WEBHOOK_SECRET: z.string(),
});

// Parse and validate environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsedEnv.error);
  throw new Error("Environment validation failed");
}

// Export validated config
const envConfig = parsedEnv.data;

// Export type for use in other files
export type EnvConfig = z.infer<typeof envSchema>;

export default envConfig;
