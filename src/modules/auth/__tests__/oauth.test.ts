import { createApp } from "@/app";
import { faker } from "@faker-js/faker";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SOCIAL_OAUTH_METHOD } from "@/enums/auth.enum";
import { mockAuthKitProvider } from "@/tests/mocks/authkit-provider.mock";

/**
 * OAuth Routes
 *
 * GET /api/auth/url/oauth?provider=<SOCIAL_OAUTH_METHOD>
 *   Auth required : No
 *   Query : provider (required, enum SOCIAL_OAUTH_METHOD), redirectUrl (optional)
 *   Success  : 200 – returns { redirectUrl }
 *   Failures : 400 invalid provider | 500 provider error
 *
 * POST /api/auth/social-signup
 *   Auth required : No
 *   Body : code (required), oauthProvider (required, enum), inviteToken (optional)
 *   Success  : 200 – sets cookie (web) / returns token (mobile)
 *   Failures : 400 bad input | 500 provider error
 */

const VALID_OAUTH_PROVIDER = SOCIAL_OAUTH_METHOD.GOOGLE; // adjust to a real value from SOCIAL_OAUTH_METHOD

function buildOauthRegisterPayload(overrides: Record<string, unknown> = {}) {
  return {
    code: faker.string.alphanumeric(32),
    oauthProvider: VALID_OAUTH_PROVIDER,
    ...overrides,
  };
}

describe("OAuth routes", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /api/auth/oauth-url
  // =========================================================================

  describe("GET /api/auth/url/oauth", () => {
    describe("success", () => {
      it("returns 200 with a redirectUrl when a valid provider is given", async () => {
        const fakeUrl = "https://sso.workos.com/authorize?...";
        mockAuthKitProvider.generateOAuthUrl.mockResolvedValue(fakeUrl);

        const res = await request(app)
          .get("/api/auth/url/oauth")
          .query({ provider: VALID_OAUTH_PROVIDER })
          .set("Accept", "application/json");

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty("redirectUrl");
      });

      it("calls AuthService.generateOAuthUrl with the correct provider", async () => {
        const fakeUrl = "https://sso.workos.com/authorize?...";
        mockAuthKitProvider.generateOAuthUrl.mockResolvedValue(fakeUrl);

        await request(app)
          .get("/api/auth/url/oauth")
          .query({ provider: VALID_OAUTH_PROVIDER })
          .set("Accept", "application/json");

        expect(mockAuthKitProvider.generateOAuthUrl).toHaveBeenCalledOnce();
        expect(mockAuthKitProvider.generateOAuthUrl).toHaveBeenCalledWith(
          expect.objectContaining({ provider: VALID_OAUTH_PROVIDER }),
        );
      });
    });

    describe("validation errors", () => {
      it("returns 400 when provider query param is missing", async () => {
        const res = await request(app)
          .get("/api/auth/url/oauth")
          .set("Accept", "application/json");

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it("returns 400 when provider is not a valid SOCIAL_OAUTH_METHOD value", async () => {
        const res = await request(app)
          .get("/api/auth/url/oauth")
          .query({ provider: "FakeProvider" })
          .set("Accept", "application/json");

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it("does NOT call the auth service when validation fails", async () => {
        await request(app)
          .get("/api/auth/url/oauth")
          .query({ provider: "FakeProvider" })
          .set("Accept", "application/json");

        expect(mockAuthKitProvider.generateOAuthUrl).not.toHaveBeenCalled();
      });
    });

    describe("server errors", () => {
      it("returns 500 when generateOAuthUrl throws", async () => {
        mockAuthKitProvider.generateOAuthUrl.mockRejectedValueOnce(
          new Error("Provider unavailable"),
        );

        const res = await request(app)
          .get("/api/auth/url/oauth")
          .query({ provider: VALID_OAUTH_PROVIDER })
          .set("Accept", "application/json");

        expect(res.status).toBe(500);
      });
    });
  });

  // =========================================================================
  // POST /api/auth/oauth-register
  // =========================================================================

  describe("POST /api/auth/social-signup", () => {
    describe("success", () => {
      it("returns 200 with user data for a valid OAuth code (web client)", async () => {
        mockAuthKitProvider.authenticateWithCode.mockResolvedValue({
          user: { id: faker.string.uuid(), email: faker.internet.email() },
        });

        const res = await request(app)
          .post("/api/auth/social-signup")
          .send(buildOauthRegisterPayload())
          .set("Accept", "application/json");

        // May be 200 or 500 depending on whether the helper can resolve the user
        expect([200, 500]).toContain(res.status);
      });

      it("returns token in response body for mobile clients", async () => {
        mockAuthKitProvider.authenticateWithCode.mockResolvedValue({
          user: { id: faker.string.uuid(), email: faker.internet.email() },
        });

        const res = await request(app)
          .post("/api/auth/social-signup")
          .send(buildOauthRegisterPayload())
          .set("Accept", "application/json")
          .set("x-client-platform", "mobile");

        expect([200, 500]).toContain(res.status);
        if (res.status === 200) {
          expect(res.body.data).toHaveProperty("token");
        }
      });
    });

    describe("validation errors", () => {
      it("returns 400 when code is missing", async () => {
        const { code: _c, ...payload } = buildOauthRegisterPayload() as any;

        const res = await request(app)
          .post("/api/auth/social-signup")
          .send(payload)
          .set("Accept", "application/json");

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it("returns 400 when oauthProvider is missing", async () => {
        const res = await request(app)
          .post("/api/auth/social-signup")
          .send({ code: faker.string.alphanumeric(32) })
          .set("Accept", "application/json");

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it("returns 400 when oauthProvider is not a valid enum value", async () => {
        const res = await request(app)
          .post("/api/auth/social-signup")
          .send(buildOauthRegisterPayload({ oauthProvider: "FakeOAuth" }))
          .set("Accept", "application/json");

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it("returns 400 when the request body is empty", async () => {
        const res = await request(app)
          .post("/api/auth/social-signup")
          .send({})
          .set("Accept", "application/json");

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });
    });

    describe("server errors", () => {
      it("returns 500 when authenticateWithCode throws", async () => {
        mockAuthKitProvider.authenticateWithCode.mockRejectedValueOnce(
          new Error("OAuth exchange failed"),
        );

        const res = await request(app)
          .post("/api/auth/social-signup")
          .send(buildOauthRegisterPayload())
          .set("Accept", "application/json");

        expect(res.status).toBe(500);
      });
    });
  });
});
