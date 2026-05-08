import mongoose from "mongoose";
import { REFUND_STATUS } from "@/enums";

const ObjectId = mongoose.Schema.Types.ObjectId;

export interface IRefund {
  _id: mongoose.Types.ObjectId;
  refundedAmount: number;
  orderRef: mongoose.Types.ObjectId;
  status: REFUND_STATUS;
  reason: string;
}

export interface IRefundDocument extends IRefund, Document {
  createdAt: Date;
  updatedAt: Date;
}

const RefundsSchema = new mongoose.Schema<IRefundDocument>(
  {
    refundedAmount: {
      type: Number,
      default: 0,
      required: true,
    },
    orderRef: {
      type: ObjectId,
      required: true,
      ref: "Orders",
      unique: true,
    },
    status: {
      type: String,
      enum: Object.values(REFUND_STATUS),
      default: REFUND_STATUS.PENDING,
      required: true,
    },
    reason: {
      type: String,
      default: "requested_by_customer",
      required: true,
    },
  },
  { timestamps: true },
);

export const Refund = mongoose.model<IRefundDocument>("Refund", RefundsSchema);
