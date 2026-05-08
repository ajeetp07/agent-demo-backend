# Boilerplate Backend

A production-ready Express + TypeScript backend with built-in authentication, payments, real-time features, and more.

> 📖 For a detailed breakdown of every folder and file, see [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md).

---

## Tech Stack

- **Runtime:** Node.js (≥ 18, ≤ 22)
- **Language:** TypeScript
- **Framework:** Express 4
- **Database:** MongoDB (Mongoose)
- **Validation:** Zod
- **Auth:** [WorkOS AuthKit](https://workos.com/docs/user-management)
- **Payments:** Stripe (Connect, Payments, Subscriptions)
- **Real-time:** Socket.IO
- **Email:** AWS SES
- **File Storage:** AWS S3
- **SMS:** Twilio
- **Push Notifications:** OneSignal
- **Chat:** GetStream
- **AI / RAG:** LangChain + OpenAI + Mongodb Vector Store + Elasticsearch

---

## Prerequisites

- **Node.js** ≥ 18.0.0 and ≤ 22
- **MongoDB** running locally or a remote connection string
- **WorkOS account** — used for authentication (password login, magic links, OAuth). [Set up WorkOS →](https://workos.com/docs/user-management)

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env.development
```

See the [Environment Variables](#environment-variables) section below for details on each variable.

### 3. Set up WorkOS AuthKit

Authentication is handled through **WorkOS AuthKit**. You'll need:

1. Create a [WorkOS account](https://workos.com)
2. Set up a project and note your **Client ID** and **API Key**
3. Configure your webhook endpoint and note the **Webhook Secret**
4. Add these to your `.env.development`:

```bash
WORKOS_CLIENT_ID=your_client_id
WORKOS_API_KEY=your_api_key
WORKOS_WEBHOOK_SECRET=your_webhook_secret
```

### 4. Start the development server

```bash
npm run dev
```

The API will be available at `http://localhost:8000`.

### 5. Start the cron server (optional)

The cron server runs scheduled background jobs (Stripe transfers, error log cleanup, password expiry reminders) on a separate process:

```bash
npm run cron-dev
```

---

## Available Scripts

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Start dev server with hot reload     |
| `npm run cron-dev`   | Start cron jobs server (development) |
| `npm run build`      | Compile TypeScript to JavaScript     |
| `npm start`          | Run compiled production server       |
| `npm run cron-start` | Run compiled cron server             |
| `npm test`           | Run tests with Vitest                |
| `npm run lint`       | Run ESLint                           |
| `npm run format`     | Format code with Prettier            |
| `npm run ses-push`   | Push email templates to AWS SES      |

---

## Environment Variables

Create a `.env.development` file at the project root. Refer to [`.env.example`](./.env.example) for the full list.

### Core (Required)

| Variable             | Description                               |
| -------------------- | ----------------------------------------- |
| `DB_PATH`            | MongoDB connection string                 |
| `NODE_ENV`           | `development`, `staging`, or `production` |
| `PORT`               | API server port (default: `8000`)         |
| `HOST`               | Server host URL                           |
| `FRONTEND_HOST`      | Frontend app URL                          |
| `JWT_SECRET`         | Secret key for JWT signing                |
| `OTP_HASH_SECRET`    | Secret key for OTP hashing                |
| `ALLOWED_ORIGINS`    | Comma-separated CORS origins              |
| `COOKIE_DOMAIN_NAME` | Domain for auth cookies                   |

### WorkOS AuthKit (Required)

| Variable                | Description                   |
| ----------------------- | ----------------------------- |
| `WORKOS_CLIENT_ID`      | WorkOS project client ID      |
| `WORKOS_API_KEY`        | WorkOS API key                |
| `WORKOS_WEBHOOK_SECRET` | WorkOS webhook signing secret |

### AWS (Required)

| Variable           | Description               |
| ------------------ | ------------------------- |
| `S3_USER_KEY`      | AWS IAM access key        |
| `S3_USER_SECRET`   | AWS IAM secret key        |
| `S3_BUCKET_NAME`   | S3 bucket name            |
| `S3_BUCKET_REGION` | S3 bucket region          |
| `SES_TEST_EMAIL`   | SES verified test email   |
| `SES_SENDER_EMAIL` | SES verified sender email |

### Stripe (Required for payments)

| Variable                        | Description                 |
| ------------------------------- | --------------------------- |
| `STRIPE_SECRET_KEY`             | Stripe secret key           |
| `STRIPE_ACCOUNT_ID`             | Stripe account ID           |
| `STRIPE_WEBHOOK_SECRET`         | Subscription webhook secret |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Connect webhook secret      |
| `STRIPE_PAYMENT_WEBHOOK_SECRET` | Payment webhook secret      |

### Third-Party Services

| Variable                      | Description            |
| ----------------------------- | ---------------------- |
| `TWILIO_NUMBER`               | Twilio phone number    |
| `TWILIO_ACCOUNTSID`           | Twilio Account SID     |
| `TWILIO_AUTHTOKEN`            | Twilio Auth Token      |
| `GET_STREAM_MESSAGING_KEY`    | GetStream API key      |
| `GET_STREAM_MESSAGING_SECRET` | GetStream API secret   |
| `ONE_SIGNAL_APP_ID`           | OneSignal App ID       |
| `ONE_SIGNAL_REST_API_KEY`     | OneSignal REST API key |
| `OPENAI_API_KEY`              | OpenAI API key         |
| `OPENAI_MODAL`                | OpenAI model name      |
| `OPENAI_EMBEDDING_MODAL`      | OpenAI embedding model |
| `ELASTIC_SEARCH_HOST_URL`     | Elasticsearch host URL |
| `ELASTIC_SEARCH_API_KEY`      | Elasticsearch API key  |

### Optional

| Variable                 | Description                        |
| ------------------------ | ---------------------------------- |
| `CRON_PORT`              | Cron server port (default: `8001`) |
| `BACKUP_PATH`            | DB backup path                     |
| `REQUEST_TIMEOUT`        | HTTP request timeout (ms)          |
| `SLACK_WEBHOOK_FOR_LOGS` | Slack incoming webhook URL         |
| `APPLE_CLIENT_ID`        | Apple Sign-In client ID (web)      |
| `APPLE_CLIENT_ID_IOS`    | Apple Sign-In client ID (iOS)      |
| `COHERE_CLIENT_TOKEN`    | Cohere API token                   |

---

## Production Build

```bash
# Build
npm run build

# Start
npm start
```

## Docker

```bash
# Build image
docker build -t boilerplate-backend .

# Run with Docker Compose
docker-compose up
```

---

## Running Tests

Tests use **Vitest** with an in-memory MongoDB instance (no real database needed).

```bash
npm test
```

Module tests are co-located inside each module's `__tests__/` folder. See [`src/tests/TESTING.md`](./src/tests/TESTING.md) for testing guidelines.

---

## Slack Incoming Webhook Setup (Optional)

To enable error logging to Slack:

1. Go to your Slack workspace → **Apps** section
2. Search for **Incoming Webhooks** and click **Add**
3. Click **Add to Slack** and select the channel for logs
4. Copy the webhook URL and set it as `SLACK_WEBHOOK_FOR_LOGS` in your `.env`

---

## Project Structure

For a full breakdown of the architecture, folder layout, module patterns, middleware pipeline, and more, see:

📄 **[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)**

---
