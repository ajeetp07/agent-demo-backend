import { createApp } from "@/app";
import envConfig from "@/config/env";
import { hashRecoveryCode, RecoveryCodeModel } from "@/db/models/recoveryCodes";
import { User } from "@/db/models/user";
import { COOKIE_NAME } from "@/enums";
import { jwtHelper, JWT_CONFIG } from "@/helpers/jwt";
import { generateRecoveryCodes } from "@/modules/auth/utils/auth.util";
import { createTestSession } from "@/tests/utils/auth";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/auth/mfa/recovery
 *
 * Auth required : pendingMfaToken cookie
 * Body : recoveryCode (string)
 *
 * Success  : 200 – sets auth cookies, marks code as used
 * Failures : 400 invalid/used code | 401 missing/invalid pending mfa token
 *
 * Regression: AGE-5 — recovery codes are stored hashed in their raw form
 * (e.g. "A1B2C3D4") but returned to the user formatted with a dash
 * ("A1B2-C3D4"). Submitting the displayed form previously failed to match
 * because the dashed string was hashed directly. The handler must normalize
 * input by stripping dashes/whitespace before hashing.
 */

async function seedUserWithRecoveryCodes() {
  const session = await createTestSession();

  await User.findByIdAndUpdate(session.user._id, {
    $set: {
      "mfa.enrolled": true,
      "mfa.enabled": true,
      "mfa.factorId": "factor_test",
      "mfa.factorIds": ["factor_test"],
    },
  });

  const rawCodes = generateRecoveryCodes();

  await RecoveryCodeModel.insertMany(
    rawCodes.map((code) => ({
      code: hashRecoveryCode(code),
      used: false,
      userRef: session.user._id,
    })),
  );

  const pendingMfaToken = jwtHelper.generateToken(
    { _id: session.user._id.toString(), email: session.user.email },
    JWT_CONFIG.PENDING_MFA_TOKEN_EXPIRY,
    envConfig.MFA_JWT_TOKEN_SECRET,
  );

  return {
    user: session.user,
    rawCodes,
    pendingMfaCookie: `${COOKIE_NAME.PENDING_MFA_TOKEN}=${pendingMfaToken}`,
  };
}

function toDisplayedForm(rawCode: string) {
  return `${rawCode.slice(0, 4)}-${rawCode.slice(4)}`;
}

describe("POST /api/auth/mfa/recovery", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("success", () => {
    it("accepts a recovery code in the displayed dashed form (AGE-5 regression)", async () => {
      const { rawCodes, pendingMfaCookie } = await seedUserWithRecoveryCodes();

      const displayed = toDisplayedForm(rawCodes[0]);

      const res = await request(app)
        .post("/api/auth/mfa/recovery")
        .set("Cookie", pendingMfaCookie)
        .send({ recoveryCode: displayed })
        .set("Accept", "application/json");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const stored = await RecoveryCodeModel.findOne({
        code: hashRecoveryCode(rawCodes[0]),
      }).lean();
      expect(stored?.used).toBe(true);
      expect(stored?.usedAt).toBeInstanceOf(Date);
    });

    it("accepts a recovery code without the dash", async () => {
      const { rawCodes, pendingMfaCookie } = await seedUserWithRecoveryCodes();

      const res = await request(app)
        .post("/api/auth/mfa/recovery")
        .set("Cookie", pendingMfaCookie)
        .send({ recoveryCode: rawCodes[0] })
        .set("Accept", "application/json");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("ignores surrounding whitespace and casing in the submitted code", async () => {
      const { rawCodes, pendingMfaCookie } = await seedUserWithRecoveryCodes();

      const messy = ` ${toDisplayedForm(rawCodes[0]).toLowerCase()} `;

      const res = await request(app)
        .post("/api/auth/mfa/recovery")
        .set("Cookie", pendingMfaCookie)
        .send({ recoveryCode: messy })
        .set("Accept", "application/json");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("business scenarios", () => {
    it("rejects a code that has already been used", async () => {
      const { rawCodes, pendingMfaCookie } = await seedUserWithRecoveryCodes();

      const displayed = toDisplayedForm(rawCodes[0]);

      const first = await request(app)
        .post("/api/auth/mfa/recovery")
        .set("Cookie", pendingMfaCookie)
        .send({ recoveryCode: displayed });
      expect(first.status).toBe(200);

      const second = await request(app)
        .post("/api/auth/mfa/recovery")
        .set("Cookie", pendingMfaCookie)
        .send({ recoveryCode: displayed });

      expect(second.status).toBe(400);
      expect(second.body.success).toBe(false);
    });

    it("rejects an unknown recovery code", async () => {
      const { pendingMfaCookie } = await seedUserWithRecoveryCodes();

      const res = await request(app)
        .post("/api/auth/mfa/recovery")
        .set("Cookie", pendingMfaCookie)
        .send({ recoveryCode: "DEAD-BEEF" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("auth", () => {
    it("returns 401 when the pending MFA cookie is missing", async () => {
      const res = await request(app)
        .post("/api/auth/mfa/recovery")
        .send({ recoveryCode: "AAAA-BBBB" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
