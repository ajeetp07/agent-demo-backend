import { SOCIAL_OAUTH_METHOD } from "@/enums/auth.enum";

export interface IAuthProviderUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  emailVerified?: boolean;
  metadata?: Record<string, any>;
}

export interface IAuthResponse {
  user: IAuthProviderUser;
  token?: string;
}

export interface ICreateUserOptions {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  emailVerified?: boolean;
}

export interface IUpdateUserOptions {
  userId: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  metadata?: Record<string, any>;
  externalId?: string;
}

export interface IAuthenticateWithPasswordOptions {
  email: string;
  password?: string;
}

export interface ICreateMagicLinkSessionOptions {
  email: string;
  redirectURI: string;
}

export interface IVerifyMagicLinkTokenOptions {
  code: string;
}

export interface IGenerateOAuthUrlOptions {
  provider: SOCIAL_OAUTH_METHOD;
  redirectUri: string;
}

export interface IAuthProvider {
  createUser(options: ICreateUserOptions): Promise<IAuthProviderUser>;
  updateUser(options: IUpdateUserOptions): Promise<IAuthProviderUser>;
  authenticateWithPassword(
    options: IAuthenticateWithPasswordOptions,
  ): Promise<IAuthResponse>;
  authenticateWithCode(code: string): Promise<IAuthResponse>;
  createMagicLinkSession(
    options: ICreateMagicLinkSessionOptions,
  ): Promise<{ link: string }>;
  verifyMagicLinkToken(
    options: IVerifyMagicLinkTokenOptions,
  ): Promise<IAuthProviderUser>;
  generateOAuthUrl?(options: IGenerateOAuthUrlOptions): Promise<string>;
}
