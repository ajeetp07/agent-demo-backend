import envConfig from "@/config/env";
import { Company } from "@/db/models/company";
import { IInvitedUsers, InvitedUsers } from "@/db/models/invitedUsers";
import { User } from "@/db/models/user";
import { INVITED_USER_STATUS, USER_TYPE } from "@/enums";
import { JWT_CONFIG, jwtHelper } from "@/helpers/jwt";
import { MFA_ENROLLMENT_REQUIRED_AT_SIGNUP } from "@/modules/auth/utils/auth.constant";
import {
  TRegisterLoginOauthParams,
  TRegisterParams,
} from "@/modules/auth/utils/auth.types";
import {
  buildPasswordTimestamps,
  getPasswordRotationConfig,
} from "@/modules/auth/utils/auth.util";
import { referralsHelper } from "@/modules/referrals/helpers/referrals.helper";
import { authService } from "@/providers/auth";
import { isUserInactiveOrDeleted } from "../utils/auth.util";
import { validateInvitation } from "./invite.helper";

function isMfaRequiredForRole(role: string): boolean {
  return role === USER_TYPE.ADMIN || role === USER_TYPE.SUPER_ADMIN;
}

/**
 * Handles standard email/password registration
 * @param data - Registration details including email, password, name, and optional referral/invite tokens
 * @returns Object containing the created user and their session token
 */
export async function register(data: TRegisterParams) {
  const { email, password, name, referralCode, inviteToken } = data;

  // 1. Validate invitation if an invite token is provided
  let invitation: IInvitedUsers | null = null;
  if (inviteToken) {
    invitation = await validateInvitation({ inviteToken, email });
  }

  const isInvite = !!invitation;
  const userRole = isInvite && invitation ? invitation.role : USER_TYPE.ADMIN;
  let companyRef = invitation?.companyRef;
  let companyConfig: {
    rotatePassword: boolean;
    passwordValidityDays: number;
    passwordGraceDays: number;
  } | null = null;

  // 2. Create user in External Auth Provider
  const authProviderUser = await authService.createUser({
    email,
    password: password || "",
    firstName: name.first,
    lastName: name.last,
    emailVerified: true,
  });
  const externalUserId = authProviderUser.id;

  // 3. Create a new company if the user is an Admin and not joining via invitation
  if (!companyRef && userRole === USER_TYPE.ADMIN) {
    const createdCompany = await Company.create({ name: email });
    companyRef = createdCompany._id;
    companyConfig = getPasswordRotationConfig(createdCompany);
  } else if (companyRef) {
    const company = await Company.findById(companyRef).select(
      "rotatePassword passwordValidityDays passwordGraceDays",
    );
    companyConfig = getPasswordRotationConfig(company);
  }

  const passwordTimestamps = password
    ? buildPasswordTimestamps(companyConfig?.passwordValidityDays)
    : {};

  const hasPassword = !!password;

  // 4. Create local user record
  const user = await User.create({
    email,
    externalUserId,
    name,
    hasPassword,
    ...passwordTimestamps,
    companyRef,
    mfa: {
      enrolled: false,
    },
    roles: userRole,
  });

  // 5. Link company back to the admin user
  if (companyRef && userRole === USER_TYPE.ADMIN) {
    await Company.findByIdAndUpdate(companyRef, { userRef: user._id });
  }

  // 6. Update invitation status if applicable
  if (isInvite) {
    await InvitedUsers.updateOne(
      { invitedEmail: email },
      { status: INVITED_USER_STATUS.ACCEPTED },
    );
  }

  // 7. Apply referral rewards if a referral code was used
  if (referralCode) {
    await referralsHelper.applyReferralCode(user._id, referralCode);
  }

  // 8. Update the externalId in the Auth Provider with the db user ID for future reference (optional but can be useful for syncing)
  await authService.updateUser({
    userId: externalUserId,
    externalId: user._id.toString(),
  });

  //9. if mfa is required then generate a temporary token for MFA enrollment instead of logging in the user directly
  if (MFA_ENROLLMENT_REQUIRED_AT_SIGNUP) {
    const pendingMfaToken = jwtHelper.generateToken(
      {
        _id: user._id.toString(),
        email: user.email,
      },
      JWT_CONFIG.PENDING_MFA_TOKEN_EXPIRY,
      envConfig.MFA_JWT_TOKEN_SECRET,
    );
    return { user, pendingMfaToken };
  }

  // 10. Generate JWT session token
  const token = jwtHelper.generateToken({
    _id: user._id.toString(),
    email: user.email,
  });

  return { user, token };
}

/**
 * Handles social registration and login (OAuth)
 * @param data - Contains the OAuth code, provider name, and optional invite token
 * @returns Object containing the user and their session token
 */
export async function registerLoginOauth(data: TRegisterLoginOauthParams) {
  const { code, oauthProvider, inviteToken } = data;

  let authProviderUser: any | null = null;

  // 1. Authenticate with Auth Provider using the OAuth code
  const result = await authService.authenticateWithCode(code);
  authProviderUser = result.user;

  if (!authProviderUser) {
    throw new Error("Something went wrong during social authentication!");
  }

  const firstName = authProviderUser.firstName || "USER";
  const lastName = authProviderUser.lastName || "BYLDD";
  const email = authProviderUser.email;

  // 2. Check if user already exists in local DB
  let user = await User.findOne({ email });

  if (isUserInactiveOrDeleted(user)) {
    throw new Error("Your account is disabled or deleted!");
  }

  // 3. If user doesn't exist, create a new record (Registration flow for Social Login)
  if (!user) {
    let invitation: IInvitedUsers | null = null;

    // Validate invitation if an invite token is provided
    if (inviteToken) {
      invitation = await validateInvitation({ inviteToken, email });
    }

    const isInvite = !!invitation;
    const userRole = isInvite && invitation ? invitation.role : USER_TYPE.ADMIN;
    let companyRef = invitation?.companyRef;

    // Create company for new Admin users
    if (!companyRef && userRole === USER_TYPE.ADMIN) {
      const createdCompany = await Company.create({ name: email });
      companyRef = createdCompany._id;
    }

    // Create local user profile
    user = await User.create({
      email,
      oauth: oauthProvider?.toUpperCase(),
      name: { first: firstName, last: lastName },
      externalUserId: authProviderUser.id,
      companyRef,
      roles: userRole,
    });

    //

    // Link company to admin
    await Company.findByIdAndUpdate(companyRef, { userRef: user._id });

    // Sync OAuth provider metadata back to Auth Provider
    if (oauthProvider) {
      await authService.updateUser({
        userId: authProviderUser.id,
        externalId: user._id.toString(),
        metadata: {
          ...authProviderUser.metadata,
          OAuthProvider: oauthProvider,
        },
      });
    }
  }

  // 4. Generate JWT session token
  const token = jwtHelper.generateToken({
    _id: user._id.toString(),
    email: user.email,
  });

  return { user, token };
}
