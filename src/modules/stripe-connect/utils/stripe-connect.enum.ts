export enum STRIPE_ACCOUNT {
  EXPRESS = "express",
  APPLICATION = "application",
}

export enum REFUND_STATUS {
  SUCCEEDED = "succeeded",
}

export enum REFUND_PERIOD {
  ELIGIBILITY_DAYS = 10,
}

export enum TRANSFER_STATUS {
  PENDING = "pending",
  SUCCEEDED = "succeeded",
  FAILED = "failed",
}

export enum RECOVERY_STATUS {
  RECOVERED = "recovered",
  PARTIALLY_RECOVERED = "partially_recovered",
  NOT_APPLICABLE = "not_applicable",
}

export enum PLATFORM_FEE_PERCENTAGE {
  PERCENTAGE = 0.1, // 10%
}

export enum TIER {
  TIER1 = "tier1",
  TIER2 = "tier2",
}

export enum DURATION {
  MONTHLY = "monthly",
  YEARLY = "yearly",
  WEEKLY = "weekly",
}

export enum STRIPE_CONNECT_PAYMENT_STATUS {
  PENDING = "pending", // created payment intent but not paid yet
  PAID = "paid", // Payment done successfully
  REFUNDED = "refunded", // paid but refunded/cancelled the order
}
