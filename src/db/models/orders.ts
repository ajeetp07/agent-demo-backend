import mongoose from "mongoose";
import { PAYMENT_STATUS, STATUS } from "@/enums";

const ObjectId = mongoose.Schema.Types.ObjectId;

export interface IOrders {
  _id: mongoose.Types.ObjectId;
  productRef?: mongoose.Types.ObjectId;
  chargeId: string;
  userRef?: mongoose.Types.ObjectId;
  paymentStatus: PAYMENT_STATUS;
  status: STATUS;
  paymentMethodDetails?: Record<string, unknown>;
}

export interface IOrdersDocument extends IOrders, Document {
  createdAt: Date;
  updatedAt: Date;
}

const OrdersSchema = new mongoose.Schema<IOrdersDocument>(
  {
    productRef: {
      type: ObjectId,
      required: false,
      ref: "Products",
    },
    chargeId: {
      type: String,
      required: true,
      unique: true,
    },
    userRef: {
      type: ObjectId,
      required: false,
      ref: "User",
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      require: true,
    },
    status: {
      type: String,
      enum: Object.values(STATUS),
      default: STATUS.ACTIVE,
    },
    paymentMethodDetails: {},
  },
  { timestamps: true },
);

export const Orders = mongoose.model<IOrdersDocument>("Orders", OrdersSchema);
