import { OTP_PURPOSE, OtpVerificationModel } from "@/db/models/otpVerification";
import { hashRecoveryCode, RecoveryCodeModel } from "@/db/models/recoveryCodes";
import { IUser, User } from "@/db/models/user";
import { ObjectId } from "@/helpers/common";
import { jwtHelper } from "@/helpers/jwt";
import { OTP_EXPIRY_MINUTES } from "@/modules/auth/utils/auth.constant";
import {
  TSkipMfaResponse,
  TVerifyMfaChallengeParams,
  TVerifyMfaChallengeResponse,
  TVerifyMfaSetupParams,
  TVerifyMfaSetupResponse,
  TVerifyResetRequestParams,
} from "@/modules/auth/utils/auth.types";
import { workos } from "@/providers/auth/authkit.provider";
import { emailService } from "@/providers/email";
import status from "http-status";
import { generateRecoveryCodes } from "../utils/auth.util";
import { generateOtp, getOtpExpiry } from "./otp.helper";

export async function initiateMfaSetup({
  email,
  userId,
}: {
  email: string;
  userId: string;
}) {
  const data = await workos.mfa.enrollFactor({
    user: email,
    type: "totp",
    issuer: "Byldd BP",
  });

  await User.findByIdAndUpdate(ObjectId(userId), {
    $addToSet: { "mfa.factorIds": data.id },
  }).exec();

  const challenge = await workos.mfa.challengeFactor({
    authenticationFactorId: data.id,
  });

  return {
    qrCode: data.totp?.qrCode,
    uri: data.totp?.uri,
    secret: data.totp?.secret,
    challengeId: challenge.id,
    factorId: data.id,
  };
}

export async function createMfaChallenge(factorId: string) {
  return workos.mfa.challengeFactor({
    authenticationFactorId: factorId,
  });
}

export async function verifyMfaSetup({
  userId,
  challengeId,
  code,
  factorId,
  user,
}: TVerifyMfaSetupParams): Promise<TVerifyMfaSetupResponse> {
  const data = await workos.mfa.verifyChallenge({
    authenticationChallengeId: challengeId,
    code,
  });

  if (!data.valid) {
    return {
      message: "Invalid code or challenge expired.",
      statusCode: status.BAD_REQUEST,
      error: true,
    };
  }

  const remainingFactorIds: string[] = [];

  if (user?.mfa.factorIds?.length) {
    const factorIdsToRemove = user.mfa.factorIds.filter(
      (id) => id !== factorId,
    );

    const result = await Promise.allSettled([
      factorIdsToRemove.map((id) => workos.mfa.deleteFactor(id)),
    ]);

    result.forEach((res, index) => {
      if (res.status === "rejected") {
        remainingFactorIds.push(factorIdsToRemove[index]);
      }
    });
  }

  const updatedUser = await User.findByIdAndUpdate(
    ObjectId(userId),
    {
      $set: {
        "mfa.enrolled": true,
        "mfa.enabled": true,
        "mfa.factorId": factorId,
        "mfa.factorIds": [...remainingFactorIds, factorId],
      },
    },
    { new: true },
  ).exec();

  if (!updatedUser) {
    return {
      message: "User not found.",
      statusCode: status.NOT_FOUND,
      error: true,
    };
  }

  const token = jwtHelper.generateToken({
    _id: updatedUser._id.toString(),
    email: updatedUser.email,
  });

  // Delete existing recovery codes
  await RecoveryCodeModel.deleteMany({ userRef: ObjectId(userId) });

  const recoveryCodes = generateRecoveryCodes();

  await RecoveryCodeModel.insertMany(
    recoveryCodes.map((code) => ({
      code: hashRecoveryCode(code),
      used: false,
      userRef: ObjectId(userId),
    })),
  );

  return {
    user: updatedUser,
    token,
    statusCode: status.OK,
    recoveryCodes: recoveryCodes.map((c) => `${c.slice(0, 4)}-${c.slice(4)}`),
    error: false,
    message: "Success",
  };
}

export async function verifyMfaChallenge({
  challengeId,
  code,
  userId,
  email,
}: TVerifyMfaChallengeParams): Promise<TVerifyMfaChallengeResponse> {
  const data = await workos.mfa.verifyChallenge({
    authenticationChallengeId: challengeId,
    code,
  });

  if (!data.valid) {
    return {
      message: "Invalid code or challenge expired.",
      statusCode: status.BAD_REQUEST,
      error: true,
    };
  }

  const token = jwtHelper.generateToken({
    _id: userId,
    email,
  });

  return {
    token,
    statusCode: status.OK,
    error: false,
    message: "Success",
  };
}

export async function resetMfaEmailOtp(email: string) {
  const otp = generateOtp(6);

  await OtpVerificationModel.create({
    identifier: email,
    otpCode: otp,
    purpose: OTP_PURPOSE.MFA_RESET,
    expiresAt: getOtpExpiry(OTP_EXPIRY_MINUTES.MFA_RESET),
  });

  return emailService.sendEmail({
    to: email,
    subject: "Reset MFA",
    text: `Your One-Time Password (OTP) for resetting MFA is: ${otp}. This OTP will expire in ${OTP_EXPIRY_MINUTES.MFA_RESET} minutes.`,
  });
}

export async function verifyResetRequest(data: TVerifyResetRequestParams) {
  if (data.method === "authenticator") {
    const challenge = await workos.mfa.challengeFactor({
      authenticationFactorId: data.factorId,
    });

    return await workos.mfa.verifyChallenge({
      authenticationChallengeId: challenge.id,
      code: data.code,
    });
  }

  const otpVerification = await OtpVerificationModel.findOne({
    identifier: data.email,
    purpose: OTP_PURPOSE.MFA_RESET,
  });

  if (!otpVerification) {
    throw new Error("Invalid OTP");
  }

  const verified = otpVerification.verifyOtp(data.code);

  if (!verified) {
    throw new Error("Invalid OTP");
  }
}

export async function updateSessionForRecovery(user: IUser) {
  const token = jwtHelper.generateToken(
    {
      _id: user._id.toString(),
      email: user.email,
    },
    "1min",
  );

  return { token };
}

export async function recoverMfa({
  user,
  code,
}: {
  user: IUser;
  code: string;
}) {
  const recoveryCode = await RecoveryCodeModel.findOneAndUpdate(
    {
      userRef: user._id,
      code: hashRecoveryCode(code),
      used: false,
    },
    {
      used: true,
      usedAt: new Date(),
    },
    { new: true },
  ).exec();

  if (!recoveryCode) {
    return {
      error: true,
      message: "Invalid or already used recovery code",
      statusCode: status.BAD_REQUEST,
    };
  }

  const token = jwtHelper.generateToken({
    _id: user._id.toString(),
    email: user.email,
  });

  return {
    token,
    statusCode: status.OK,
    error: false,
    message: "Success",
  };
}

export async function skipMfaSetup({
  user,
  mfaFactorId,
}: {
  user: IUser;
  mfaFactorId: string;
}): Promise<TSkipMfaResponse> {
  await workos.mfa.deleteFactor(mfaFactorId).catch(() => {});

  const updatedUser = await User.findByIdAndUpdate(
    user._id,
    {
      $set: {
        "mfa.enrolled": false,
        "mfa.factorIds": user.mfa?.factorIds?.filter(
          (id) => id !== mfaFactorId,
        ),
      },
    },
    { new: true },
  ).exec();

  if (!updatedUser) {
    return {
      message: "User not found.",
      statusCode: status.NOT_FOUND,
      error: true,
    };
  }

  const token = jwtHelper.generateToken({
    _id: updatedUser._id.toString(),
    email: updatedUser.email,
  });

  return {
    token,
    user: updatedUser,
    statusCode: status.OK,
    error: false,
    message: "Success",
  };
}

export async function disableMfa(user: IUser) {
  // 1. delete all factors

  const mfaData = user.mfa;

  if (mfaData?.factorIds?.length) {
    await Promise.allSettled(
      mfaData.factorIds.map((id) => workos.mfa.deleteFactor(id)),
    );
  }

  // 2. update user
  const updatedUser = await User.findByIdAndUpdate(
    user._id,
    {
      $set: {
        "mfa.enrolled": false,
        "mfa.enabled": false,
        "mfa.factorIds": [],
        "mfa.factorId": null,
      },
    },
    { new: true },
  ).exec();

  // 3. Invalidated all recovery codes

  await RecoveryCodeModel.deleteMany({
    userRef: user._id,
  });

  return updatedUser;
}
