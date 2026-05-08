import mongoose from "mongoose";
import { STATUS } from "@/enums";

export interface ISubscriptionPlan {
  _id: mongoose.Types.ObjectId;
  title: string;
  type: string;
  currency: string;
  price: number;
  description?: string;
  image?: string;
  productId?: string;
  priceId: string;
  status: STATUS;
}

export interface ISubscriptionPlanDocument extends ISubscriptionPlan, Document {
  createdAt: Date;
  updatedAt: Date;
}

// For Future Reference => If you want to store the stripe plans to DB
const SubscriptionPlanSchema = new mongoose.Schema<ISubscriptionPlanDocument>(
  {
    title: {
      type: String,
      required: true,
    },
    type: {
      type: String, // Basic, Premium
      required: true,
    },
    currency: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: false,
    },
    image: {
      type: String,
      required: false,
    },

    productId: {
      type: String, // stripe subscription product Id
      required: false,
    },
    priceId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(STATUS),
      required: true,
      default: STATUS.ACTIVE,
    },
  },
  { timestamps: true },
);

export const SubscriptionPlan = mongoose.model<ISubscriptionPlanDocument>(
  "SubscriptionPlan",
  SubscriptionPlanSchema,
);
