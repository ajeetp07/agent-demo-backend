import { Company, ICompanyDocument } from "@/db/models/company";
import { IUserDocument, User } from "@/db/models/user";
import { STATUS, USER_TYPE } from "@/enums";
import { jwtHelper } from "@/helpers/jwt";
import { faker } from "@faker-js/faker";
import mongoose from "mongoose";

export interface ITestSession {
  user: IUserDocument;
  company: ICompanyDocument;
  token: string;
  /** Formatted as "token=<jwt>" — pass to .set("Cookie", session.cookie) */
  cookie: string;
  /** Formatted as "Bearer <jwt>" — pass to .set("Authorization", ...) */
  bearerHeader: string;
}

export async function createTestSession(
  role: USER_TYPE = USER_TYPE.ADMIN,
  extras: Record<string, unknown> = {},
): Promise<ITestSession> {
  // 1. Create a Company
  const company = await Company.create({
    name: faker.company.name(),
    companyStatus: STATUS.ACTIVE,
  });

  // 2. Create a User linked to that Company
  const user = await User.create({
    email: faker.internet.email().toLowerCase(),
    name: { first: faker.person.firstName(), last: faker.person.lastName() },
    externalUserId: faker.string.uuid(),
    hasPassword: true,
    roles: role,
    status: STATUS.ACTIVE,
    companyRef: company._id,
    ...extras,
  });

  // 3. Link company back to user
  await Company.findByIdAndUpdate(company._id, { userRef: user._id });

  // 4. Generate JWT (same logic as the real app)

  const token = jwtHelper.generateToken({
    _id: user._id.toString(),
    email: user.email,
  });

  return {
    user,
    company: company as ICompanyDocument,
    token,
    cookie: `token=${token}`,
    bearerHeader: `Bearer ${token}`,
  };
}

export const createAdminSession = () => createTestSession(USER_TYPE.ADMIN);

export const createSuperAdminSession = () =>
  createTestSession(USER_TYPE.SUPER_ADMIN);

export const createUserSession = () => createTestSession(USER_TYPE.USER);

export async function seedProduct(
  companyId: mongoose.Types.ObjectId,
  overrides: Record<string, unknown> = {},
) {
  const { Products } = await import("@/db/models/products");

  return Products.create({
    title: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    price: parseFloat(faker.commerce.price()),
    companyRef: companyId,
    ...overrides,
  });
}
