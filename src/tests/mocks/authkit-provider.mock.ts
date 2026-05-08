import { vi } from "vitest";

export const mockAuthKitProvider = {
  createUser: vi.fn(),
  updateUser: vi.fn(),
  authenticateWithPassword: vi.fn(),
  authenticateWithCode: vi.fn(),
  createMagicLinkSession: vi.fn(),
  verifyMagicLinkToken: vi.fn(),
  generateOAuthUrl: vi.fn(),
};

export class AuthKitProvider {
  createUser = mockAuthKitProvider.createUser;
  updateUser = mockAuthKitProvider.updateUser;
  authenticateWithPassword = mockAuthKitProvider.authenticateWithPassword;
  authenticateWithCode = mockAuthKitProvider.authenticateWithCode;
  createMagicLinkSession = mockAuthKitProvider.createMagicLinkSession;
  verifyMagicLinkToken = mockAuthKitProvider.verifyMagicLinkToken;
  generateOAuthUrl = mockAuthKitProvider.generateOAuthUrl;
}

vi.mock(
  "@/providers/auth/authkit.provider",
  () => import("@/tests/mocks/authkit-provider.mock"),
);
