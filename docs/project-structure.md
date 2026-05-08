# 📁 Boilerplate Backend — Project Structure

A comprehensive guide to the folder layout, architecture patterns, and code conventions used in this Express + TypeScript backend.

---

## Table of Contents

- [High-Level Overview](#high-level-overview)
- [Tech Stack](#tech-stack)
- [Root Directory](#root-directory)
- [Source Directory (`src/`)](#source-directory-src)
  - [Entry Points](#entry-points)
  - [Config (`config/`)](#config-config)
  - [Database Layer (`db/`)](#database-layer-db)
  - [Modules (`modules/`)](#modules-modules)
  - [Middleware (`middleware/`)](#middleware-middleware)
  - [Providers (`providers/`)](#providers-providers)
  - [Webhooks (`webhooks/`)](#webhooks-webhooks)
  - [Cron Jobs (`cron/`)](#cron-jobs-cron)
  - [Helpers (`helpers/`)](#helpers-helpers)
  - [Types (`types/`)](#types-types)
  - [Enums (`enums/`)](#enums-enums)
  - [Constants (`constants/`)](#constants-constants)
  - [Tests (`tests/`)](#tests-tests)
- [Request Lifecycle](#request-lifecycle)
- [Module Deep-Dive: Anatomy of a Module](#module-deep-dive-anatomy-of-a-module)
- [Routing & Role-Based Access](#routing--role-based-access)
- [API Response Format](#api-response-format)
- [Environment Configuration](#environment-configuration)
- [Docker & Deployment](#docker--deployment)
- [Development Scripts](#development-scripts)

---

## High-Level Overview

```
boilerplate-backend/
│
├── src/                    # All application source code
│   ├── app.ts              # Express app factory (middleware + routes)
│   ├── server.ts           # HTTP server bootstrap (DB + Socket.IO)
│   ├── config/             # App & env configuration
│   ├── constants/          # Shared constant values
│   ├── cron/               # Scheduled background jobs
│   ├── db/                 # Database connection & Mongoose models
│   ├── enums/              # Shared enumerations
│   ├── helpers/            # Reusable utility functions
│   ├── middleware/         # Express middleware (auth, rate-limit, etc.)
│   ├── modules/            # Feature modules (routes + controllers + helpers)
│   ├── providers/          # Third-party SDK wrappers and services
│   ├── tests/              # Test infrastructure (mocks, setup)
│   ├── types/              # Shared TypeScript type definitions
│   └── webhooks/           # Inbound webhook handlers
│
├── @types/                 # Global TypeScript declaration overrides
├── scripts/                # Build & dev helper scripts
├── server/                 # Compiled JS output (build artifact)
├── Dockerfile              # Multi-stage Docker build
├── docker-compose.yaml     # Local Docker setup
├── package.json            # Dependencies & scripts
├── tsconfig.json           # TypeScript configuration
├── vitest.config.mts       # Test runner configuration
└── eslint.config.mjs       # Linting rules
```

---

## Tech Stack

| Layer                  | Technology                                    |
| ---------------------- | --------------------------------------------- |
| **Runtime**            | Node.js ≥ 18, ≤ 22                            |
| **Language**           | TypeScript ~5.7                               |
| **Framework**          | Express 4                                     |
| **Database**           | MongoDB via Mongoose 8                        |
| **Validation**         | Zod 4 + zod-express-validator                 |
| **Auth**               | WorkOS AuthKit / Supabase, JWT                |
| **Payments**           | Stripe (Connect + Payments + Subscriptions)   |
| **Real-time**          | Socket.IO 4                                   |
| **Chat**               | GetStream                                     |
| **Email**              | AWS SES                                       |
| **File Storage**       | AWS S3 (+ Azure/GCP stubs)                    |
| **SMS**                | Twilio                                        |
| **Push Notifications** | OneSignal                                     |
| **AI / RAG**           | LangChain + OpenAI + Pinecone + Elasticsearch |
| **Testing**            | Vitest + mongodb-memory-server + Supertest    |
| **Linting**            | ESLint 9 + Prettier                           |
| **CI/CD**              | Docker, GitHub Workflows                      |

---

## Root Directory

| File / Folder               | Purpose                                                                       |
| --------------------------- | ----------------------------------------------------------------------------- |
| `package.json`              | Dependencies, scripts, engine constraints                                     |
| `tsconfig.json`             | TypeScript compiler options, path aliases, base configuration (`@/` → `src/`) |
| `tsconfig.build.json`       | Build-specific TS config (extends base)                                       |
| `vitest.config.mts`         | Vitest test runner configuration                                              |
| `eslint.config.mjs`         | ESLint flat-config rules                                                      |
| `.prettierrc`               | Prettier formatting options                                                   |
| `.commitlintrc.json`        | Conventional commit message enforcement                                       |
| `lint-staged.config.mjs`    | Pre-commit lint-staged rules                                                  |
| `.husky/`                   | Git hooks (commit-msg, pre-commit)                                            |
| `nodemon.json`              | Dev server auto-reload configuration                                          |
| `.env.example`              | Template for required environment variables                                   |
| `.env` / `.env.development` | Environment variables (git-ignored)                                           |
| `Dockerfile`                | Multi-stage production Docker image                                           |
| `docker-compose.yaml`       | Local development with Docker                                                 |
| `@types/`                   | Global TS declaration merges (`express`, `jwt`, `vitest`)                     |
| `scripts/`                  | Utility scripts (e.g. `verifyEnvBackEnd.js`)                                  |
| `server/`                   | Compiled JavaScript output from `tsc`                                         |

---

## Source Directory (`src/`)

### Entry Points

#### `server.ts` — Bootstrap

The main entry point. It:

1. Creates the Express app via `createApp()`
2. Connects to MongoDB via `connectDB()`
3. Creates an HTTP server
4. Initializes Socket.IO via `SocketService`
5. Starts listening on the configured `PORT`

```typescript
// Simplified flow
async function bootstrap() {
  const app = createApp();
  await connectDB();
  const server = http.createServer(app);
  const socketService = new SocketService(server);
  app.set("socketService", socketService);
  server.listen(PORT);
}
```

#### `app.ts` — Express App Factory

Configures the Express application with this middleware pipeline:

```
Request ──► trust proxy
        ──► helmet (security headers)
        ──► CORS
        ──► URL-encoded parser
        ──► rate limiter
        ──► client platform detector
        ──► /webhook routes (raw body)
        ──► cookie parser
        ──► JSON parser
        ──► compression (gzip)
        ──► /api routes (all feature modules)
        ──► 404 catch-all
        ──► global error handler
```

---

### Config (`config/`)

```
config/
├── api.ts        # Rate-limiting & payload size limits
├── cookies.ts    # Cookie configuration
├── cors.ts       # CORS allowed origins & methods
└── env.ts        # Zod-validated environment variables
```

**`env.ts`** is the most critical config file. It:

- Loads `.env.development`, `.env.staging`, or `.env` based on `NODE_ENV`
- Defines a **Zod schema** for every environment variable with types, defaults, and constraints
- Validates all variables at startup — the server **will not start** if validation fails
- Exports a strongly-typed `envConfig` object used throughout the app

**`api.ts`** centralises rate-limiting and payload size settings:

| Setting                    | Default              |
| -------------------------- | -------------------- |
| `RATE_LIMIT_WINDOW_MS`     | 60,000 ms (1 minute) |
| `RATE_LIMIT_MAX_REQUESTS`  | 100 requests/window  |
| `API_MAX_PAYLOAD_SIZE`     | 100kb                |
| `API_MAX_URL_ENCODED_SIZE` | 100kb                |

---

### Database Layer (`db/`)

```
db/
├── index.ts          # Connection helpers (dev/prod + in-memory test DB)
├── models/           # Mongoose model definitions
│   ├── user.ts
│   ├── company.ts
│   ├── products.ts
│   ├── orders.ts
│   ├── subscription.ts
│   ├── subscriptionPlan.ts
│   ├── notifications.ts
│   ├── referrals.ts
│   ├── referral-reward.ts
│   ├── errorLogs.ts
│   ├── invitedUsers.ts
│   ├── otpVerification.ts
│   ├── userQuery.ts
│   ├── userNotificationPreference.ts
│   ├── refund.ts
│   ├── ragChat/          # RAG-related models
│   ├── stripeConnect/    # Stripe Connect models
│   └── stripePayment/   # Stripe Payment models
└── seeders/          # Database seed scripts
    ├── product.ts
    ├── stripe-connect-products.ts
    └── user-queries.ts
```

**Key patterns:**

- Each model file exports a Mongoose schema, model, and TypeScript interface
- `index.ts` provides `connectDB()` / `disconnectDB()` for dev/prod and `connectTestDB()` / `clearTestDB()` / `disconnectTestDB()` for in-memory test databases

---

### Modules (`modules/`)

This is where **all feature code** lives. Modules are the core building blocks.

```
modules/
├── api.ts              # Main API router — mounts all feature routes under /api
├── admin.ts            # Admin router — mounts admin-specific routes under /api/admin
├── super-admin.ts      # Super Admin router — mounts SA routes under /api/super-admin
├── system.ts           # System router — internal/system routes under /api/system
│
├── auth/               # Authentication (login, signup, OAuth, OTP, magic link)
├── users/              # User profile management
├── company/            # Company/org management
├── products/           # Product CRUD
├── cards/              # Card management
├── chat/               # GetStream chat integration
├── rag/                # RAG-powered AI chat
├── notifications/      # Push & in-app notifications
├── referrals/          # Referral program
├── invite-user/        # User invitation flow
├── subscription/       # Subscription management
├── stripe-connect/     # Stripe Connect (marketplace payouts)
├── stripe-payment/     # Stripe Payments (one-time charges)
├── user-query/         # Support / help desk queries
├── error-logs/         # System error log management
└── file-upload/        # File upload (S3 pre-signed URLs)
```

> 📖 See [Module Deep-Dive](#module-deep-dive-anatomy-of-a-module) for the internal structure of each module.

---

### Middleware (`middleware/`)

```
middleware/
├── auth.ts              # JWT decoding + role-based access guards
├── client-platform.ts   # Detects mobile vs web clients
├── error-handler.ts     # Global error handler + DB error logging
└── rate-limiter.ts      # express-rate-limit configuration
```

**`auth.ts`** — The `Middleware` class provides these guards:

| Method                 | Purpose                                                                        |
| ---------------------- | ------------------------------------------------------------------------------ |
| `jwtDecoder`           | Extracts JWT from cookies (web) or Bearer token (mobile), populates `req.user` |
| `authMiddleware`       | Requires authenticated user (any role: User, Admin, Super Admin)               |
| `adminMiddleware`      | Requires Admin or Super Admin role                                             |
| `superAdminMiddleware` | Requires Super Admin role only                                                 |
| `systemMiddleware`     | Requires System role                                                           |

Token handling is **platform-aware**: cookies for web clients, Bearer tokens for mobile.

**`error-handler.ts`** — Logs errors to the `ErrorLogs` MongoDB collection with sanitized request context (passwords, tokens redacted), then returns a standardized error response.

---

### Providers (`providers/`)

Providers encapsulate external APIs and third-party SDKs (e.g. Email, Authentication, Payments, Real-time APIs) into unified interfaces. Feature modules consume these providers directly to interact with external systems.

```
providers/
├── auth/
│   ├── index.ts                  # AuthProvider factory
│   ├── authkit.provider.ts       # WorkOS AuthKit implementation
│   └── supabase.provider.ts      # Supabase Auth implementation
│
├── email/
│   ├── index.ts                  # EmailService factory
│   ├── ses.provider.ts           # AWS SES provider
│   ├── sendgrid.provider.ts      # SendGrid provider (stub)
│   └── templates/                # Email HTML templates
│
├── file-storage/
│   ├── index.ts                  # FileStorage factory
│   ├── s3.provider.ts            # AWS S3 implementation
│   ├── azure.provider.ts         # Azure Blob (stub)
│   └── gcp.provider.ts           # Google Cloud Storage (stub)
│
├── payment/
│   └── stripe/                   # Stripe SDK wrapper
│
├── push-notification/
│   ├── index.ts
│   └── onesignal.provider.ts     # OneSignal implementation
│
├── sms/
│   ├── index.ts
│   └── twilio.provider.ts        # Twilio implementation
│
├── socket/
│   └── index.ts                  # Socket.IO real-time service provider
│
└── stream-chat/
    └── index.ts                  # GetStream chat provider
```

**`socket/index.ts`** — Typed Socket.IO service with room-based and user-specific event emission:

- `emit()` — Broadcast to all clients
- `emitToRoom()` — Emit to a specific room
- `emitToUser()` — Emit to a specific user's room (`user:{userId}`)

---

**Design principle:** Each provider folder has an `index.ts` factory that returns the active implementation. Switching providers (e.g. SES → SendGrid) only requires changing the factory — no module code changes.

---

### Webhooks (`webhooks/`)

Inbound webhook handlers for third-party event processing.

```
webhooks/
├── index.ts                  # WebhookRouter — mounts all webhook routes under /webhook
├── authkit/                  # WorkOS AuthKit webhook events
├── getstream/                # GetStream chat webhook events
├── onesignal/                # OneSignal notification events
├── stripe-connect/           # Stripe Connect webhook events
├── stripe-payment/           # Stripe Payment webhook events
└── subscription/             # Stripe Subscription webhook events
```

**Important:** Stripe webhooks use `raw()` body parsing (required for signature verification), while others use `json()`.

```
/webhook/subscription      → raw body  → StripeSubscriptionWebhookRouter
/webhook/stripe-payment     → raw body  → StripePaymentWebhookRouter
/webhook/stripe-connect     → raw body  → StripeConnectWebhookRouter
/webhook/getstream          → json body → GetStreamWebhookRouter
/webhook/onesignal          → json body → OnesignalWebhookRouter
/webhook/authkit            → json body → AuthkitWebhookRouter
```

---

### Cron Jobs (`cron/`)

Scheduled tasks running on a **separate process** (different port).

```
cron/
├── index.ts              # Cron server bootstrap + schedule definitions
└── helper/
    ├── stripeConnect.ts   # Process pending Stripe Connect transfers
    ├── errorLogs.ts       # Delete previous month's error logs
    └── passwordRotation.ts # Send password expiry reminders
```

| Schedule                     | Job                               | Description                            |
| ---------------------------- | --------------------------------- | -------------------------------------- |
| `0 0 * * *` (daily midnight) | `processTransfers()`              | Process pending Stripe Connect payouts |
| `0 0 1 * *` (1st of month)   | `deletePreviousMonthEntries()`    | Clean up old error logs                |
| `0 9 * * *` (daily 9 AM)     | `sendPasswordRotationReminders()` | Email 14/7/1-day expiry warnings       |

**Start separately:** `npm run cron-dev` (development) or `npm run cron-start` (production)

---

### Helpers (`helpers/`)

Reusable utility functions used across modules.

```
helpers/
├── api-response.ts       # SuccessResponse() & ErrorResponse() wrappers
├── app-error.ts          # Custom AppError class
├── common.ts             # General utilities (ObjectId casting, isMobileRequest, etc.)
├── cookie.ts             # Cookie set/clear helpers
├── jwt.ts                # JWT sign/verify (singleton)
├── notification.ts       # Notification creation helpers
├── pagination.ts         # Pagination response builder
├── query.ts              # MongoDB aggregation pipeline helpers (facets, etc.)
└── validation-error.ts   # Validation error formatting
```

---

### Types (`types/`)

Shared TypeScript type/interface definitions.

```
types/
├── index.ts                      # Barrel export
├── api-config.types.ts           # IApiConfig, IApiResponse
├── auth.types.ts                 # IAuthProvider, login/signup options
├── common.types.ts               # Shared common types
├── email.types.ts                # Email template data maps
├── file-storage.types.ts         # File storage interfaces
├── getstream.types.ts            # GetStream chat types
├── pagination.types.ts           # Pagination request/response types
├── push-notification.types.ts    # Push notification payload types
├── query.types.ts                # MongoDB query builder types
├── sms.types.ts                  # SMS service types
├── socket.types.ts               # Socket.IO typed events
└── stripe.types.ts               # Stripe-related types
```

---

### Enums (`enums/`)

Shared enumeration values.

```
enums/
├── index.ts                      # Barrel export
├── auth.enum.ts                  # AUTH_PROVIDER enum
├── common.enum.ts                # STATUS, USER_TYPE, SERVER_ENV, ERROR_TYPE, etc.
├── email.enum.ts                 # EMAIL_TEMPLATE_NAME
├── file-storage.enum.ts          # File storage providers
├── payment.enum.ts               # Payment-related enums
├── push-notification.enum.ts     # Push notification enums
└── sms.enum.ts                   # SMS provider enums
```

---

### Constants (`constants/`)

Hard-coded constant values.

```
constants/
├── common.ts         # Shared constants
├── error-codes.ts    # Application error code definitions
└── pagination.ts     # DEFAULT_PAGE, DEFAULT_PAGE_SIZE
```

---

### Tests (`tests/`)

Test infrastructure (not individual test files — those live inside each module's `__tests__/` folder).

```
tests/
├── TESTING.md        # Testing guidelines documentation
├── setup.ts          # Vitest global setup (in-memory DB connect/clear/disconnect)
├── mocks/            # Shared mock factories
│   └── ...           # Mock data generators
└── utils/            # Test utility helpers
```

**Individual module tests** are co-located:

```
modules/products/__tests__/
modules/auth/__tests__/
```

---

## Request Lifecycle

Here's how a typical API request flows through the system:

```
Client Request
     │
     ▼
  ┌──────────────────┐
  │  Express App     │
  │  (app.ts)        │
  ├──────────────────┤
  │ 1. Helmet        │ ← Security headers
  │ 2. CORS          │ ← Origin validation
  │ 3. URL Parser    │ ← Parse URL-encoded
  │ 4. Rate Limiter  │ ← 100 req/min limit
  │ 5. Platform Det. │ ← Detect mobile/web
  │ 6. Cookie Parser │ ← Parse cookies
  │ 7. JSON Parser   │ ← Parse JSON body
  │ 8. Compression   │ ← gzip response
  └────────┬─────────┘
           │
     ┌─────▼─────┐         ┌───────────┐
     │  /webhook  │────────►│ Webhook   │ (raw/json body, no auth)
     └───────────┘         │ Handlers  │
           │               └───────────┘
     ┌─────▼─────┐
     │   /api     │
     └─────┬─────┘
           │
     ┌─────▼──────────┐
     │  JWT Decoder    │ ← Extracts & validates token, populates req.user
     └─────┬──────────┘
           │
     ┌─────▼──────────────────────────────────┐
     │  Route-Level Middleware                 │
     │  ┌────────────┐ ┌───────┐ ┌──────────┐ │
     │  │ authMiddle- │ │ admin │ │ super-   │ │
     │  │ ware       │ │ M.W.  │ │ admin MW │ │
     │  └────────────┘ └───────┘ └──────────┘ │
     └─────┬──────────────────────────────────┘
           │
     ┌─────▼──────────┐
     │  Zod Validator  │ ← Validates req.body / req.query / req.params
     └─────┬──────────┘
           │
     ┌─────▼──────────┐
     │  Controller     │ ← Handles request, calls Helper
     └─────┬──────────┘
           │
     ┌─────▼──────────┐
     │  Helper         │ ← Business logic + DB operations
     └─────┬──────────┘
           │
     ┌─────▼──────────┐
     │  Provider       │ ← External APIs (email, payment, etc.)
     └─────┬──────────┘
           │
     ┌─────▼──────────┐
     │  API Response   │ ← SuccessResponse() or ErrorResponse()
     └────────────────┘
```

---

## Module Deep-Dive: Anatomy of a Module

Every feature module follows a consistent internal structure. Using `products/` as an example:

```
modules/products/
├── index.ts                           # Router classes (one per role)
├── product.controller.ts              # User-level controller
├── product-admin.controller.ts        # Admin-level controller
├── product-super-admin.controller.ts  # Super Admin-level controller
├── helpers/
│   └── product.helper.ts             # Business logic (DB queries)
├── utils/
│   ├── product.types.ts              # Module-specific TypeScript types
│   ├── product.validation.ts         # Zod validation schemas
│   └── product.constant.ts           # Module-specific constants/messages
└── __tests__/                         # Co-located unit/integration tests
```

### Layer Responsibilities

| Layer          | File                    | Responsibility                                                   |
| -------------- | ----------------------- | ---------------------------------------------------------------- |
| **Router**     | `index.ts`              | Mount middleware guards, bind validators + controllers to routes |
| **Controller** | `*.controller.ts`       | Parse request, call helper, format response                      |
| **Helper**     | `helpers/*.helper.ts`   | Business logic, DB operations (aggregations, CRUD)               |
| **Validation** | `utils/*.validation.ts` | Zod schemas for request body/query/params                        |
| **Types**      | `utils/*.types.ts`      | Controller & helper TypeScript types                             |
| **Constants**  | `utils/*.constant.ts`   | Success/error message strings                                    |

### Role-Based Controllers

Modules that serve multiple roles export **separate Router classes** from `index.ts`:

```typescript
// modules/products/index.ts exports:
export class ProductsRouter { ... }           // User-facing (GET only)
export class AdminProductsRouter { ... }      // Admin (CRUD)
export class SuperAdminProductsRouter { ... } // Super Admin (full CRUD)
```

Each router applies the appropriate middleware guard:

```typescript
// User routes
this.router.use(middleware.authMiddleware);

// Admin routes
this.router.use(middleware.adminMiddleware);

// Super Admin routes
this.router.use(middleware.superAdminMiddleware);
```

---

## Routing & Role-Based Access

The API has four top-level route groups:

```
/api
├── /auth              ← Public (login, signup, OAuth)
├── /user              ← Authenticated users
├── /products          ← Authenticated users (read-only)
├── /referrals         ← Authenticated users
├── /notification      ← Authenticated users
├── /stripe-connect    ← Authenticated users
├── /stripe-payment    ← Authenticated users
├── /chat              ← Authenticated users
├── /help              ← Authenticated users
├── /aws               ← Authenticated users (file upload)
│
├── /admin             ← Admin + Super Admin only
│   ├── /user
│   ├── /products
│   ├── /invite-users
│   ├── /subscription
│   ├── /stripe-connect
│   ├── /stripe-payment
│   ├── /help
│   ├── /company
│   ├── /chat          (RAG)
│   └── /cards
│
├── /super-admin       ← Super Admin only
│   ├── /products
│   ├── /subscription
│   ├── /user
│   ├── /company
│   ├── /stripe
│   └── /referrals
│
└── /system            ← System role only
    └── /error-logs

/webhook               ← No auth (signature verification per provider)
├── /subscription
├── /stripe-payment
├── /stripe-connect
├── /getstream
├── /onesignal
└── /authkit
```

---

## API Response Format

All responses follow a consistent JSON structure:

```json
{
  "success": true,           // or false
  "message": "Products fetched successfully",
  "data": { ... },           // Response payload
  "errors": {},              // Validation or error details
  "messageCode": "OPTIONAL"  // Machine-readable error/success code
}
```

Built using `SuccessResponse()` and `ErrorResponse()` from `helpers/api-response.ts`.

---

## Environment Configuration

Environment variables are managed through three files:

| File               | Used When              |
| ------------------ | ---------------------- |
| `.env.development` | `NODE_ENV=development` |
| `.env.staging`     | `NODE_ENV=staging`     |
| `.env`             | Production / default   |

All variables are **validated with Zod** at startup. Key variable groups:

| Group             | Variables                                                             |
| ----------------- | --------------------------------------------------------------------- |
| **Database**      | `DB_PATH`                                                             |
| **Server**        | `PORT`, `HOST`, `FRONTEND_HOST`, `JWT_SECRET`, `ALLOWED_ORIGINS`      |
| **AWS**           | `S3_USER_KEY`, `S3_USER_SECRET`, `S3_BUCKET_NAME`, `SES_SENDER_EMAIL` |
| **Stripe**        | `STRIPE_SECRET_KEY`, webhook secrets                                  |
| **Twilio**        | `TWILIO_NUMBER`, `TWILIO_ACCOUNTSID`, `TWILIO_AUTHTOKEN`              |
| **WorkOS**        | `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_WEBHOOK_SECRET`         |
| **OpenAI**        | `OPENAI_API_KEY`, `OPENAI_MODAL`, `OPENAI_EMBEDDING_MODAL`            |
| **GetStream**     | `GET_STREAM_MESSAGING_KEY`, `GET_STREAM_MESSAGING_SECRET`             |
| **OneSignal**     | `ONE_SIGNAL_APP_ID`, `ONE_SIGNAL_REST_API_KEY`                        |
| **Elasticsearch** | `ELASTIC_SEARCH_HOST_URL`, `ELASTIC_SEARCH_API_KEY`                   |

---

## Docker & Deployment

The `Dockerfile` uses a **multi-stage build**:

```
Stage 1 (base)    → Node 22 Alpine + system deps + Infisical CLI
Stage 2 (deps)    → Install npm dependencies
Stage 3 (builder) → Compile TypeScript → JavaScript
Stage 4 (runner)  → Final lean production image (port 8000)
```

```bash
# Build
docker build -t boilerplate-backend .

# Run with Docker Compose
docker-compose up
```

---

## Development Scripts

| Command              | Description                                |
| -------------------- | ------------------------------------------ |
| `npm run dev`        | Start dev server with nodemon + hot reload |
| `npm run cron-dev`   | Start cron job server in development       |
| `npm run build`      | Compile TypeScript to JavaScript           |
| `npm run build:dev`  | Build with development env validation      |
| `npm start`          | Run compiled production server             |
| `npm run cron-start` | Run compiled cron server                   |
| `npm run lint`       | Run ESLint                                 |
| `npm run format`     | Format code with Prettier                  |
| `npm test`           | Run tests with Vitest                      |
| `npm run ses-push`   | Push email templates to AWS SES            |

---

## Path Aliases

The project uses TypeScript path aliases for clean imports:

```typescript
// Instead of:
import { User } from "../../../db/models/user";

// Use:
import { User } from "@/db/models/user";
```

Configured in `tsconfig.json` (`@/` → `src/`), resolved at build time by `tsc-alias`, and at dev time by `tsconfig-paths`.
