import envConfig from "@/config/env";
import * as jwt from "jsonwebtoken";

/**
 * JWT configuration
 */
export const JWT_CONFIG: Record<string, jwt.SignOptions["expiresIn"]> = {
  ACCESS_TOKEN_EXPIRY: "7days",
  REFRESH_TOKEN_EXPIRY: "7days",
  RESET_PASSWORD_TOKEN_EXPIRY: "1h",
  INVITE_TOKEN_EXPIRY: "7days",
  PENDING_MFA_TOKEN_EXPIRY: "15m",
} as const;

/**
 * JWT helper class for token operations
 */
export class JwtHelper {
  /**
   * Generate JWT token for user
   * @param data - Payload data
   * @param expiresIn - Token expiry time (optional)
   * @returns JWT token string
   */
  generateToken(
    data: Partial<jwt.JwtPayload>,
    expiresIn: jwt.SignOptions["expiresIn"] = JWT_CONFIG.ACCESS_TOKEN_EXPIRY,
    secret: string = envConfig.JWT_SECRET,
  ): string {
    return jwt.sign(data, secret, {
      expiresIn,
    });
  }

  /**
   * Verify and decode JWT token
   * @param token - JWT token to verify
   * @returns Decoded token payload
   */
  verifyToken(
    token: string,
    secret: string = envConfig.JWT_SECRET,
  ): jwt.JwtPayload {
    return jwt.verify(token, secret) as jwt.JwtPayload;
  }
}

export const jwtHelper = new JwtHelper();
