import envConfig from "@/config/env";
import { ICompany } from "@/db/models/company";
import { User } from "@/db/models/user";
import { COOKIE_NAME, STATUS, USER_TYPE } from "@/enums";
import { ErrorResponse } from "@/helpers/api-response";
import { ObjectId } from "@/helpers/common";
import { cookieHelper } from "@/helpers/cookie";
import { jwtHelper } from "@/helpers/jwt";
import { LOGIN_METHOD } from "@/modules/auth/utils/auth.enum";
import { evaluatePasswordRotationState } from "@/modules/auth/utils/auth.util";
import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";

export class Middleware {
  public authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!this.hasValidToken(req) || !req.user) {
        return this.sendForbiddenAccessResponse(res);
      }

      const { roles } = req.user;
      const allowedRoles = [
        USER_TYPE.SUPER_ADMIN,
        USER_TYPE.ADMIN,
        USER_TYPE.USER,
      ];

      if (!allowedRoles.includes(roles)) {
        return this.sendForbiddenAccessResponse(res);
      }

      // Adding companyRef in case super-admin wants to access user apis
      if (roles === USER_TYPE.SUPER_ADMIN) {
        req.user.companyRef = req.query.companyRef || req.body.companyRef;
      }

      next();
    } catch {
      return this.sendForbiddenAccessResponse(res);
    }
  };

  public jwtDecoder = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      let token: string | null = null;

      // Extract token based on client platform
      if (req.isMobile) {
        // For mobile: get token from Authorization header
        token = this.extractBearerToken(req);
      } else {
        // For web: get token from cookies
        token = req.cookies && req.cookies.token;
      }

      if (!token) {
        return next();
      }

      const decoded = jwtHelper.verifyToken(token);

      const user = await User.findOne({
        $and: [{ _id: ObjectId(decoded._id) }],
      })
        .populate<{ companyRef: ICompany }>("companyRef")
        .lean();

      if (!user) {
        return this.sendForbiddenAccessResponse(res);
      }

      const reqUser = {
        ...user,
        company: user.companyRef,
        companyRef: user.companyRef?._id,
      };

      if (
        user.status === STATUS.INACTIVE ||
        reqUser?.company?.companyStatus === STATUS.INACTIVE
      ) {
        // For web: clear cookie
        if (!req.isMobile) {
          cookieHelper.clearAuthCookies(res);
        }

        return ErrorResponse(res, httpStatus.UNAUTHORIZED, {
          message: "Invalid Token",
        });
      }

      req.user = reqUser;

      const rotationState = evaluatePasswordRotationState({
        user: reqUser,
        company: reqUser.company || null,
      });

      const isAllowedWhileBlocked =
        req.path.includes("/change-password") ||
        req.path.includes("/logout") ||
        req.path.includes("/support") ||
        req.path.includes("/unread-count") ||
        req.path.includes("/user/me");

      if (
        rotationState.isBlocked &&
        !isAllowedWhileBlocked &&
        decoded.loginMethod === LOGIN_METHOD.PASSWORD
      ) {
        return ErrorResponse(res, httpStatus.FORBIDDEN, {
          message: "Password Expired. Please reset your password.",
          messageCode: rotationState.errorCode,
        });
      }
      next();
    } catch (error) {
      if (!req.isMobile) {
        cookieHelper.clearAuthCookies(res);
      }

      return ErrorResponse(res, httpStatus.UNAUTHORIZED, {
        message: "Invalid Token",
      });
    }
  };

  public superAdminMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user || req.user.roles !== USER_TYPE.SUPER_ADMIN) {
      return this.sendForbiddenAccessResponse(res);
    }
    next();
  };

  public adminMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user || req.user.roles === USER_TYPE.USER) {
      return this.sendForbiddenAccessResponse(res);
    }
    // Admin and super admin should be able to access the admin api
    if ([USER_TYPE.SUPER_ADMIN, USER_TYPE.ADMIN].includes(req.user.roles)) {
      // Adding companyRef in case super admin wants to access admin apis
      if (req.user.roles === USER_TYPE.SUPER_ADMIN)
        req.user.companyRef = req.query.companyRef || req.body.companyRef;

      next();
    } else {
      return this.sendForbiddenAccessResponse(res);
    }
  };

  public systemMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user || req.user.roles !== USER_TYPE.SYSTEM) {
      return this.sendForbiddenAccessResponse(res);
    }
    next();
  };

  private extractBearerToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.split(" ")[1];
    }
    return null;
  }

  private hasValidToken(req: Request): boolean {
    if (req.isMobile) {
      return !!this.extractBearerToken(req);
    } else {
      return !!(req.cookies && req.cookies.token);
    }
  }

  private sendForbiddenAccessResponse(res: Response) {
    cookieHelper.clearAuthCookies(res);
    return ErrorResponse(res, httpStatus.UNAUTHORIZED, {
      message: "Forbidden Access",
    });
  }

  public pendingMfaMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (req.user) return next();

      const pendingMfaToken = req.cookies?.[COOKIE_NAME.PENDING_MFA_TOKEN];

      if (!pendingMfaToken) {
        return ErrorResponse(res, httpStatus.UNAUTHORIZED, {
          message: "Invalid mfa token",
        });
      }

      const decoded = jwtHelper.verifyToken(
        pendingMfaToken,
        envConfig.MFA_JWT_TOKEN_SECRET,
      );

      if (!decoded) {
        return ErrorResponse(res, httpStatus.UNAUTHORIZED, {
          message: "Invalid mfa token",
        });
      }

      const user = await User.findById(decoded._id).lean();

      if (!user) {
        return ErrorResponse(res, httpStatus.UNAUTHORIZED, {
          message: "Invalid mfa token",
        });
      }

      req.user = user;

      next();
    } catch (error) {
      console.log(error);
      cookieHelper.clearCookies(res, [COOKIE_NAME.PENDING_MFA_TOKEN]);
      return ErrorResponse(res, httpStatus.UNAUTHORIZED, {
        message: "Invalid mfa token",
      });
    }
  };
}
