import { createApp } from "@/app";
import { faker } from "@faker-js/faker";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockAuthKitProvider } from "@/tests/mocks/authkit-provider.mock";
import { createTestSession } from "@/tests/utils/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/login
 *
 * Auth required : No
 * Body : email (required), password (optional), loginType (required: "password"|"otp"), otp (optional)
 *
 * Success  : 200 – sets cookie (web) / returns token (mobile)
 * Failures : 400 bad input | 401 wrong credentials / disabled account | 500 server error
 */

function buildPasswordLoginPayload(overrides: Record<string, unknown> = {}) {
  return {
    email: faker.internet.email().toLowerCase(),
    password: "StrongPass@123",
    loginType: "password",
    ...overrides,
  };
}

function buildOtpLoginPayload(overrides: Record<string, unknown> = {}) {
  return {
    email: faker.internet.email().toLowerCase(),
    loginType: "otp",
    otp: "1234",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("POST /api/auth/login", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Happy Path (password login)
  // =========================================================================

  describe("success — password login", () => {
    it("returns 200 with user data for a valid password login (web)", async () => {
      // Seed a real user and stub the provider to authenticate them
      const { user } = await createTestSession();

      mockAuthKitProvider.authenticateWithPassword.mockResolvedValue({
        user: { id: user.externalUserId, email: user.email },
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send(buildPasswordLoginPayload({ email: user.email }))
        .set("Accept", "application/json");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("user");
    });

    it("sets auth cookies on successful password login (web)", async () => {
      const { user } = await createTestSession();

      mockAuthKitProvider.authenticateWithPassword.mockResolvedValue({
        user: { id: user.externalUserId, email: user.email },
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send(buildPasswordLoginPayload({ email: user.email }))
        .set("Accept", "application/json");

      expect(res.status).toBe(200);
      const cookies = res.headers["set-cookie"] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.startsWith("token="))).toBe(true);
    });

    it("returns token in response body for mobile clients (password login)", async () => {
      const { user } = await createTestSession();

      mockAuthKitProvider.authenticateWithPassword.mockResolvedValue({
        user: { id: user.externalUserId, email: user.email },
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send(buildPasswordLoginPayload({ email: user.email }))
        .set("Accept", "application/json")
        .set("x-client-platform", "mobile");

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("token");
      expect(typeof res.body.data.token).toBe("string");
    });
  });

  // =========================================================================
  // 2. Validation Errors (confused user)
  // =========================================================================

  describe("validation errors", () => {
    it("returns 400 when email is missing", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ password: "pass123", loginType: "password" })
        .set("Accept", "application/json");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("returns 400 when email is malformed", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send(buildPasswordLoginPayload({ email: "not-an-email" }))
        .set("Accept", "application/json");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("returns 400 when loginType is missing", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: faker.internet.email(), password: "pass123" })
        .set("Accept", "application/json");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("returns 400 when loginType is an invalid value", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send(buildPasswordLoginPayload({ loginType: "magic" }))
        .set("Accept", "application/json");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("returns 400 when password is shorter than 6 characters", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send(buildPasswordLoginPayload({ password: "abc" }))
        .set("Accept", "application/json");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("returns 400 when otp is not 4 digits for otp loginType", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send(buildOtpLoginPayload({ otp: "12" }))
        .set("Accept", "application/json");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("returns 400 when request body is empty", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({})
        .set("Accept", "application/json");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("does NOT call the auth provider when validation fails", async () => {
      await request(app)
        .post("/api/auth/login")
        .send({ email: "bad-email", loginType: "password" })
        .set("Accept", "application/json");

      expect(
        mockAuthKitProvider.authenticateWithPassword,
      ).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Business Scenarios (wrong credentials, disabled account)
  // =========================================================================

  describe("business scenarios", () => {
    it("returns 401 when credentials are invalid", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send(buildPasswordLoginPayload({ email: "ghost@example.com" }))
        .set("Accept", "application/json");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("returns 401 when the account is disabled", async () => {
      const { user } = await createTestSession("ADMIN" as any, {
        status: "INACTIVE",
      });

      mockAuthKitProvider.authenticateWithPassword.mockResolvedValue({
        user: { id: user.externalUserId, email: user.email },
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send(buildPasswordLoginPayload({ email: user.email }))
        .set("Accept", "application/json");

      // Account is INACTIVE — controller should refuse login
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 4. Server Errors (3 AM engineer)
  // =========================================================================

  describe("server errors", () => {
    it("returns 500 when the auth provider throws during password authentication", async () => {
      mockAuthKitProvider.authenticateWithPassword.mockRejectedValueOnce(
        new Error("Provider is down"),
      );

      const { user } = await createTestSession();

      const res = await request(app)
        .post("/api/auth/login")
        .send(buildPasswordLoginPayload({ email: user.email }))
        .set("Accept", "application/json");

      expect(res.status).toBe(500);
    });
  });
});
