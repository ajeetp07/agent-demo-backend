import { OTP_PURPOSE } from "@/db/models/otpVerification";
import { IReferralReward, ReferralReward } from "@/db/models/referral-reward";
import { IUser, User } from "@/db/models/user";
import * as LoginHelper from "@/modules/auth/helpers/login.helper";
import * as MagicLinkHelper from "@/modules/auth/helpers/magic-link.helper";
import * as MfaHelper from "@/modules/auth/helpers/mfa.helper";
import * as OtpHelper from "@/modules/auth/helpers/otp.helper";
import * as PasswordHelper from "@/modules/auth/helpers/password.helper";
import * as RegisterHelper from "@/modules/auth/helpers/register.helper";
import {
  TLoginParams,
  TLoginResponse,
  TRegisterLoginOauthParams,
  TRegisterParams,
  TVerifyMfaChallengeParams,
  TVerifyMfaSetupParams,
  TVerifyResetRequestParams,
} from "@/modules/auth/utils/auth.types";

/**
 * Auth helper class — thin facade over the individual feature helpers.
 * Add new functionality in the relevant helper file, not here.
 */
class AuthHelper {
  // ==================== Registration ====================

  async register(data: TRegisterParams) {
    return RegisterHelper.register(data);
  }

  async registerLoginOauth(data: TRegisterLoginOauthParams) {
    return RegisterHelper.registerLoginOauth(data);
  }

  // ==================== Login ====================

  async login(data: TLoginParams): Promise<TLoginResponse> {
    return LoginHelper.login(data);
  }

  // ==================== Password ====================

  async sendResetEmail(email: string) {
    return PasswordHelper.sendResetEmail(email);
  }

  async updatePassword(email: string, password: string, token: string) {
    return PasswordHelper.updatePassword(email, password, token);
  }

  // ==================== Magic Link ====================

  async requestMagicLink(email: string) {
    return MagicLinkHelper.requestMagicLink(email);
  }

  async verifyMagicLink(token: string) {
    return MagicLinkHelper.verifyMagicLink(token);
  }

  // ==================== OTP ====================

  async requestOtp(identifier: string, purpose: OTP_PURPOSE) {
    return OtpHelper.requestOtp(identifier, purpose);
  }

  async resendOtp(identifier: string, purpose: OTP_PURPOSE) {
    return OtpHelper.resendOtp(identifier, purpose);
  }

  async verifyOtp(identifier: string, purpose: OTP_PURPOSE, rawOtp: string) {
    return OtpHelper.verifyOtp(identifier, purpose, rawOtp);
  }

  // ==================== Utilities ====================

  async findUserByEmail(email: string) {
    return User.findOne({ email });
  }

  async giveReferralRewards(userId: string, points: number) {
    return User.findByIdAndUpdate(
      userId,
      { $inc: { referralRewards: points } },
      { new: true },
    );
  }

  async addReferralReward(data: IReferralReward) {
    return ReferralReward.create(data);
  }

  // ==================== MFA helpers ====================

  async initiateMfaSetup({ email, userId }: { email: string; userId: string }) {
    return MfaHelper.initiateMfaSetup({ email, userId });
  }

  async verifyMfaChallenge(data: TVerifyMfaChallengeParams) {
    return MfaHelper.verifyMfaChallenge(data);
  }

  async verifyMfaSetup(data: TVerifyMfaSetupParams) {
    return MfaHelper.verifyMfaSetup(data);
  }

  async resetMfaEmailOtp(email: string) {
    return MfaHelper.resetMfaEmailOtp(email);
  }
  async verifyResetRequest(data: TVerifyResetRequestParams) {
    return MfaHelper.verifyResetRequest(data);
  }

  async updateSessionForRecoveryResetFlow(user: IUser) {
    return MfaHelper.updateSessionForRecovery(user);
  }

  async recoverMfa({ user, code }: { user: IUser; code: string }) {
    return MfaHelper.recoverMfa({ user, code });
  }

  async skipMfaSetup(data: { user: IUser; mfaFactorId: string }) {
    return MfaHelper.skipMfaSetup(data);
  }
  async disableMfa(user: IUser) {
    return MfaHelper.disableMfa(user);
  }
}

export const authHelper = new AuthHelper();
