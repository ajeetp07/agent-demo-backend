import { STATUS } from "@/enums";
import { TCentralizedFile } from "@/modules/rag/utils/rag.types";
import mongoose from "mongoose";

const ObjectId = mongoose.Schema.Types.ObjectId;

export interface ICentralizedFile {
  _id: mongoose.Types.ObjectId;
  userRef: mongoose.Types.ObjectId;
  file: TCentralizedFile;
  status: STATUS;
}

export interface ICentralizedFileDocument extends ICentralizedFile, Document {
  createdAt: Date;
  updatedAt: Date;
}

const CentralizedFileSchema = new mongoose.Schema<ICentralizedFileDocument>(
  {
    userRef: {
      type: ObjectId,
      ref: "User",
      required: true,
    },
    file: {
      fileUrl: { type: String, required: true },
      fileName: { type: String, required: true },
      status: { type: String },
      size: { type: Number, default: 0 }, // file size in bytes,
    },
    status: {
      type: String,
      enum: Object.values(STATUS),
      default: STATUS.ACTIVE,
    },
  },
  { timestamps: true },
);

export const CentralizedFile = mongoose.model<ICentralizedFileDocument>(
  "CentralizedFile",
  CentralizedFileSchema,
);
