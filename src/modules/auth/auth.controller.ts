import envConfig from "@/config/env";
import { ERROR_CODES } from "@/constants/error-codes";
import { User } from "@/db/models/user";
import { COOKIE_NAME } from "@/enums";
import { ErrorResponse, SuccessResponse } from "@/helpers/api-response";
import { cookieHelper } from "@/helpers/cookie";
import { jwtHelper } from "@/helpers/jwt";
import { authHelper } from "@/modules/auth/helpers/auth.helper";
import { LOGIN_METHOD } from "@/modules/auth/utils/auth.enum";
import type { TAuthController } from "@/modules/auth/utils/auth.types";
import { authService } from "@/providers/auth";
import { NextFunction, Request, Response } from "express";
import status from "http-status";
import {
  AUTH_RESPONSE_MESSAGES,
  MFA_ENROLLMENT_REQUIRED_AT_SIGNUP,
} from "./utils/auth.constant";
import { shouldPromptUserForMfaEnrollment } from "./utils/auth.util";

export class AuthController {
  // ==================== Registration ====================

  public register: TAuthController["register"] = async (req, res, next) => {
    try {
      const { email } = req.body;

      const existingUser = await authHelper.findUserByEmail(email);
      if (existingUser) {
        return ErrorResponse(res, status.CONFLICT, {
          message: AUTH_RESPONSE_MESSAGES.USER_ALREADY_EXISTS_EMAIL,
          messageCode: ERROR_CODES.USER_ALREADY_EXISTS,
        });
      }

      const { user, token, pendingMfaToken } = await authHelper.register(
        req.body,
      );

      if (req.isMobile) {
        return SuccessResponse(res, status.OK, {
          message: "Registration successful.",
          data: { user, token },
        });
      }

      if (pendingMfaToken) {
        cookieHelper.setPendingMfaToken(res, pendingMfaToken);
      }

      if (token && user) {
        cookieHelper.setAuthCookies(res, {
          token,
          user,
        });
      }

      return SuccessResponse(res, status.OK, {
        message: "Registration successful.",
        data: {
          user,
          redirectToMfaSetup: shouldPromptUserForMfaEnrollment(user.roles),
        },
      });
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  public registerLoginOauth: TAuthController["registerLoginOauth"] = async (
    req,
    res,
    next,
  ) => {
    try {
      const { code, oauthProvider, inviteToken } = req.body;
      const { user, token } = await authHelper.registerLoginOauth({
        code,
        oauthProvider: oauthProvider!,
        inviteToken,
      });

      if (req.isMobile) {
        return SuccessResponse(res, status.OK, {
          message: "User registered successfully.",
          data: { user, token },
        });
      }

      cookieHelper.setAuthCookies(res, {
        token,
        user,
      });

      return SuccessResponse(res, status.OK, {
        message: "User registered successfully.",
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  };

  // ==================== Login / Logout ====================

  public login: TAuthController["login"] = async (req, res, next) => {
    try {
      const { email, password, loginType, otp } = req.body;

      const result = await authHelper.login({
        email,
        password,
        loginType,
        otp,
        isMobile: req.isMobile,
        res,
      });

      if (result.error) {
        return ErrorResponse(res, result.status, { message: result.error });
      }

      const { user, token, pendingMfaToken, mfaChallengeId } = result;

      if (req.isMobile) {
        return SuccessResponse(res, status.OK, {
          message: "Success.",
          data: { user, token },
        });
      }

      if (pendingMfaToken) {
        cookieHelper.setPendingMfaToken(res, pendingMfaToken);
      }

      if (mfaChallengeId && pendingMfaToken) {
        cookieHelper.clearCookies(res, [COOKIE_NAME.MFA_CHALLENGE_ID]);

        cookieHelper.setMfaChallengeId(res, mfaChallengeId);

        return SuccessResponse(res, status.OK, {
          message: "MFA required.",
          messageCode: ERROR_CODES.MFA_REQUIRED,
          data: { user },
        });
      }

      cookieHelper.setAuthCookies(res, {
        token: token!,
        user,
      });

      const isPasswordExpired =
        Boolean(result.passwordRotation?.isBlocked) &&
        loginType === LOGIN_METHOD.PASSWORD;

      cookieHelper.setCookie(res, {
        cookieName: COOKIE_NAME.PASSWORD_EXPIRED,
        value: String(isPasswordExpired),
        httpOnly: false,
      });

      return SuccessResponse(res, result.status, {
        message: "Success.",
        data: {
          user,
          isPasswordExpired,
          passwordExpiryDaysLeft: result.passwordRotation?.daysLeft,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public logout = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      cookieHelper.clearAuthCookies(res);
      return SuccessResponse(res, status.OK, {
        message: "Logged out successfully.",
      });
    } catch (error) {
      next(error);
    }
  };

  // ==================== Password ====================

  public sendResetEmail: TAuthController["sendResetEmail"] = async (
    req,
    res,
    next,
  ) => {
    try {
      const { email } = req.body;
      const result = await authHelper.sendResetEmail(email);

      if (!result.success) {
        return ErrorResponse(res, result.status || status.BAD_REQUEST, {
          message: result.message,
        });
      }

      return SuccessResponse(res, status.OK, {
        message: "Email sent successfully.",
      });
    } catch (error) {
      next(error);
    }
  };

  public updatePassword: TAuthController["updatePassword"] = async (
    req,
    res,
    next,
  ) => {
    try {
      const { email, password, token } = req.body;
      const result = await authHelper.updatePassword(email, password, token);

      if (!result.success) {
        return ErrorResponse(res, result.status || status.UNAUTHORIZED, {
          message: result.message,
        });
      }

      return SuccessResponse(res, status.OK, {
        message: "User password updated successfully.",
        data: result.user,
      });
    } catch (error) {
      return ErrorResponse(res, status.UNAUTHORIZED, {
        message: "Invalid or expired token.",
      });
    }
  };

  // ==================== Misc ====================

  public unsubscribe = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const id = req.params.id;
      const user = await User.findByIdAndUpdate(id, {
        subscribedToNewsletter: false,
      });
      return SuccessResponse(res, status.OK, {
        message: "Success.",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  // ==================== OTP ====================

  /**
   * Works for email and phone, for all purposes.
   */
  public requestOtp: TAuthController["requestOtp"] = async (req, res, next) => {
    try {
      const { identifier, purpose } = req.body;
      const result = await authHelper.requestOtp(identifier, purpose);

      if (!result.success) {
        return ErrorResponse(res, result.statusCode, {
          message: result.message,
        });
      }

      return SuccessResponse(res, status.OK, { message: result.message });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Generates a fresh OTP (invalidating the previous one).
   */
  public resendOtp: TAuthController["requestOtp"] = async (req, res, next) => {
    try {
      const { identifier, purpose } = req.body;
      const result = await authHelper.resendOtp(identifier, purpose);

      if (!result.success) {
        return ErrorResponse(res, result.statusCode, {
          message: result.message,
        });
      }

      return SuccessResponse(res, status.OK, { message: result.message });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Returns:
   *  - Email + SIGNUP  → { email } so caller can complete registration
   *  - All other flows → auth token + user (cookie set for web)
   */
  public verifyOtp: TAuthController["verifyOtp"] = async (req, res, next) => {
    try {
      const { identifier, purpose, otp } = req.body;
      const result = await authHelper.verifyOtp(identifier, purpose, otp);

      if (!result.success) {
        return ErrorResponse(res, result.statusCode, {
          message: result.message,
        });
      }

      // Signup email flow — no session issued yet
      if (result.email) {
        return SuccessResponse(res, status.OK, {
          message: result.message,
          data: { email: result.email },
        });
      }

      // All authenticated flows — set cookie for web, return token for mobile
      if (req.isMobile) {
        return SuccessResponse(res, status.OK, {
          message: result.message,
          data: {
            user: result.user,
            token: result.token,
            warning: result.warning,
            daysLeft: result.daysLeft,
          },
        });
      }

      cookieHelper.setAuthCookies(res, {
        token: result.token!,
        user: result.user!,
      });

      return SuccessResponse(res, status.OK, {
        message: result.message,
        data: {
          user: result.user,
          warning: result.warning,
          daysLeft: result.daysLeft,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ==================== Magic Link ====================

  public requestMagicLink: TAuthController["emailOnly"] = async (
    req,
    res,
    next,
  ) => {
    try {
      const { email } = req.body;
      await authHelper.requestMagicLink(email);
      return SuccessResponse(res, status.OK, {
        message: "Magic link sent to email.",
      });
    } catch (error) {
      next(error);
    }
  };

  public verifyMagicLink: TAuthController["verifyMagicLink"] = async (
    req,
    res,
    next,
  ) => {
    try {
      const { token } = req.query;

      if (!token) {
        return ErrorResponse(res, status.UNAUTHORIZED, {
          message: "Invalid or expired link.",
        });
      }

      const {
        user,
        token: jwtToken,
        error,
        statusCode,
      } = await authHelper.verifyMagicLink(token);

      if (error) {
        return ErrorResponse(res, statusCode, {
          message: error,
        });
      }

      cookieHelper.setAuthCookies(res, {
        token: jwtToken,
        user,
      });

      return SuccessResponse(res, statusCode, {
        message: "User found.",
        data: { user },
      });
    } catch (error) {
      return ErrorResponse(res, status.UNAUTHORIZED, {
        message: "Invalid or expired link.",
      });
    }
  };

  // ==================== OAuth ====================

  public getOauthUrl: TAuthController["getOauthUrl"] = async (
    req,
    res,
    next,
  ) => {
    try {
      const { provider } = req.query;
      const authUrl = await authService.generateOAuthUrl({
        provider,
        redirectUri: `${envConfig.FRONTEND_HOST}/callback/${provider.toLowerCase()}`,
      });

      return SuccessResponse(res, status.OK, {
        data: { redirectUrl: authUrl },
      });
    } catch (error) {
      next(error);
    }
  };

  public getEmailFromInviteToken = async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const decoded = jwtHelper.verifyToken(token);
      return SuccessResponse(res, status.OK, {
        message: AUTH_RESPONSE_MESSAGES.EMAIL_RETRIEVED,
        data: decoded.email,
      });
    } catch {
      return ErrorResponse(res, status.CONFLICT, {
        message: AUTH_RESPONSE_MESSAGES.TOKEN_EXPIRED,
      });
    }
  };

  // ==================== MFA handlers ====================

  public initiateMfaSetup = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = req.user!;

      const result = await authHelper.initiateMfaSetup({
        email: user.email,
        userId: user._id.toString(),
      });

      cookieHelper.setMfaChallengeId(res, result.challengeId);
      cookieHelper.setMfaFactorId(res, result.factorId);

      return SuccessResponse(res, status.OK, {
        message: "Success.",
        data: { qrCode: result.qrCode, secret: result.secret },
      });
    } catch (error) {
      next(error);
    }
  };

  public verifyMfaSetup = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { code } = req.body;
      const { mfaChallengeId, mfaFactorId } = req.cookies;

      const user = req.user!;

      const result = await authHelper.verifyMfaSetup({
        code,
        challengeId: mfaChallengeId,
        factorId: mfaFactorId,
        userId: user._id.toString(),
        email: user.email,
        user,
      });

      if (result.error) {
        return ErrorResponse(res, result.statusCode, {
          message: result.message,
        });
      }

      cookieHelper.setAuthCookies(res, {
        token: result.token,
        user: result.user,
      });

      cookieHelper.clearMfaCookies(res);

      return SuccessResponse(res, status.OK, {
        message: "Success.",
        data: { user: result.user, recoveryCodes: result.recoveryCodes },
      });
    } catch (error) {
      next(error);
    }
  };

  public skipMfaSetup = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = req.user!;

      const { mfaFactorId } = req.cookies;

      const result = await authHelper.skipMfaSetup({ user, mfaFactorId });

      if (result.error) {
        return ErrorResponse(res, result.statusCode, {
          message: result.message,
        });
      }

      cookieHelper.clearMfaCookies(res);

      cookieHelper.setAuthCookies(res, {
        token: result.token,
        user: result.user,
      });

      return SuccessResponse(res, status.OK, {
        message: "Success.",
        data: { user: result.user },
      });
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  // This controller is used for verifying the MFA challenge during login, not for setup verification. The flow is similar to verifyMfaSetup but it does not update the user's mfaEnrolled status.
  public verifyMfa = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { code } = req.body;
      const { mfaChallengeId } = req.cookies;

      const user = req.user!;

      const result = await authHelper.verifyMfaChallenge({
        email: user.email,
        challengeId: mfaChallengeId,
        userId: user._id.toString(),
        code,
      });

      if (result.error) {
        return ErrorResponse(res, result.statusCode, {
          message: result.message,
        });
      }

      cookieHelper.clearMfaCookies(res);

      cookieHelper.setAuthCookies(res, {
        token: result.token,
        user,
      });

      // delete user.mfaSecret;

      return SuccessResponse(res, status.OK, {
        message: "Success.",
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  };

  public recoverMfa = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = req.user!;
      const code = req.body.recoveryCode;

      const result = await authHelper.recoverMfa({
        user,
        code,
      });

      if (result.error || !result.token) {
        return ErrorResponse(res, result.statusCode, {
          message: result.message,
        });
      }

      cookieHelper.clearCookies(res, [
        COOKIE_NAME.MFA_CHALLENGE_ID,
        COOKIE_NAME.PENDING_MFA_TOKEN,
      ]);

      cookieHelper.setAuthCookies(res, {
        token: result.token,
        user,
      });

      return SuccessResponse(res, status.OK, {
        message: "Success.",
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  };

  public sendResetMfaEmailOtp = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = req.user!;

      await authHelper.resetMfaEmailOtp(user.email);

      return SuccessResponse(res, status.OK, {
        message: "Success.",
        data: { sent: true },
      });
    } catch (error) {
      next(error);
    }
  };

  public verifyResetRequest = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { code, method } = req.body;
      const user = req.user!;
      const result = await authHelper.verifyResetRequest({
        code,
        method,
        factorId: user!.mfa.factorId!,
        email: user.email,
      });

      return SuccessResponse(res, status.OK, {
        message: "Success.",
        data: { verified: true },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Updates the session for the recovery reset flow
   * When user select to re-configure MFA after using Recovery code to login, will update the jwt session expiry time to 15min
   */
  public updateSessionForRecoveryReconfiguration = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = req.user!;
      const result = await authHelper.updateSessionForRecoveryResetFlow(user);

      cookieHelper.setTokenCookie(res, result.token);

      return SuccessResponse(res, status.OK, {
        message: "Success.",
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  };

  public disableMfa = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = req.user!;
      await authHelper.disableMfa(user);

      return SuccessResponse(res, status.OK, {
        message: "Success.",
        data: { disabled: true },
      });
    } catch (error) {
      next(error);
    }
  };
}
