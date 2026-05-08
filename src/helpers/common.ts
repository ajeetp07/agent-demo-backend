import { IUser, User } from "@/db/models/user";
import envConfig from "@/config/env";
import { CLIENT_PLATFORM } from "@/constants/common";
import crypto from "crypto";
import mongoose from "mongoose";
import { Request } from "express";
import { SERVER_ENV } from "@/enums";
import z from "zod";

const ObjectId = (
  value: string | mongoose.Types.ObjectId,
): mongoose.Types.ObjectId => {
  return new mongoose.Types.ObjectId(value);
};

const generateReferralCode = async () => {
  let referralCode: string = "";

  let isUnique: boolean = false;
  while (!isUnique) {
    referralCode = `${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 4)}`;
    const existingCodes = await User.find({ referralCode }).lean();
    if (existingCodes.length === 0) {
      isUnique = true;
    }
  }
  return referralCode.toUpperCase();
};

function generateOTP(length: number = 4): string {
  return crypto.randomInt(10 ** (length - 1), 10 ** length).toString();
}

function isMobileRequest(req: Request): boolean {
  return req.headers[CLIENT_PLATFORM.HEADER] === CLIENT_PLATFORM.VALUES.MOBILE;
}

function isDevEnvironment(): boolean {
  return (
    envConfig.NODE_ENV.startsWith("dev") ||
    envConfig.NODE_ENV === SERVER_ENV.DEVELOPMENT
  );
}
function isStaging(): boolean {
  return envConfig.NODE_ENV === SERVER_ENV.STAGING;
}
function isProduction(): boolean {
  return envConfig.NODE_ENV === SERVER_ENV.PRODUCTION;
}

function isTestEmail(email: string): boolean {
  return email.includes("bylddtest");
}

function validatePhoneNumber(phoneNumber: string): boolean {
  // E.164 format validation: +[country code][number]
  // Must start with + (optional), followed by 1-9, then 1-14 digits
  return /^\+?[1-9]\d{1,14}$/.test(phoneNumber);
}

function validateEmail(email: string): boolean {
  return z.email().safeParse(email).success;
}

export {
  generateOTP,
  generateReferralCode,
  isDevEnvironment,
  isMobileRequest,
  ObjectId,
  isStaging,
  isProduction,
  isTestEmail,
  validatePhoneNumber,
  validateEmail,
};
