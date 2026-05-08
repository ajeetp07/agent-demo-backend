import { companyValidators } from "@/modules/company/utils/company.validation";

// Controller types
export type TCompanyController = typeof companyValidators;

// Interfaces
export interface IUpdateCompanyBody {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: string;
  [key: string]: any;
}

export interface IChangeUserRoleBody {
  roles: string;
  userId: string;
}
