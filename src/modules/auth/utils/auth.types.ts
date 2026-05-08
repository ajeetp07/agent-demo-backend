import { TErrorCode } from "@/constants/error-codes";
import { IUser } from "@/db/models/user";
import { COOKIE_NAME } from "@/enums";
import {
  authValidators,
  RegisterBodySchema,
  LoginBodySchema,
  RegisterLoginOauthBodySchema,
} from "@/modules/auth/utils/auth.validation";
import { CookieOptions, Response } from "express";
import z from "zod";

export type TAuthController = typeof authValidators;

export type TLoginResponse =
  | {
      error: string;
      status: number;
      user?: never;
      token?: never;
      pendingMfaToken?: never;
      passwordRotation?: never;
      mfaChallengeId?: never;
    }
  | {
      error: null;
      status: number;
      user: IUser;
      token?: string | null;
      pendingMfaToken?: string | null;
      passwordRotation?: TPasswordRotationState;
      mfaChallengeId?: string;
    };

export type TRegisterParams = z.infer<typeof RegisterBodySchema>;
export type TLoginParams = z.infer<typeof LoginBodySchema> & {
  isMobile?: boolean;
  res: Response;
};
export type TRegisterLoginOauthParams = z.infer<
  typeof RegisterLoginOauthBodySchema
>;

export type TOtpVerifyResult =
  | {
      success: true;
      message: string;
      email?: string;
      token?: string;
      user?: IUser;
      warning?: TErrorCode;
      daysLeft?: number;
    }
  | { success: false; message: string; statusCode: number };

export type TOtpRequestResult =
  | { success: true; message: string }
  | { success: false; message: string; statusCode: number };

export interface IAuthCookies {
  token: string;
  user?: IUser;
}

export type TSetCookieParams = {
  cookieName: COOKIE_NAME;
  value: string;
  httpOnly?: boolean;
  options?: CookieOptions;
};

export type TPasswordRotationConfig = {
  rotatePassword: boolean;
  passwordValidityDays: number;
  passwordGraceDays: number;
};

export type TPasswordRotationState = {
  isBlocked: boolean;
  errorCode?: TErrorCode;
  daysLeft?: number;
};

export type TVerifyMfaSetupParams = {
  email: string;
  userId: string;
  challengeId: string;
  code: string;
  factorId: string;
  user?: IUser;
};

export type TVerifyMfaChallengeParams = Omit<TVerifyMfaSetupParams, "factorId">;

export type TVerifyMfaSetupResponse =
  | {
      message: string;
      statusCode: number;
      error: true;
      token?: never;
      recoveryCodes?: never;
      user?: never;
    }
  | {
      message: string;
      statusCode: number;
      error: false;
      token: string;
      recoveryCodes: string[];
      user: IUser;
    };
export type TVerifyMfaChallengeResponse =
  | {
      message: string;
      statusCode: number;
      error: true;
      token?: never;
    }
  | {
      message: string;
      statusCode: number;
      error: false;
      token: string;
    };
export type TSkipMfaResponse =
  | {
      message: string;
      statusCode: number;
      error: true;
      token?: never;
      user?: never;
    }
  | {
      message: string;
      statusCode: number;
      error: false;
      token: string;
      user: IUser;
    };

export type TVerifyResetRequestParams = {
  email: string;
  code: string;
  method: string;
  factorId: string;
};
