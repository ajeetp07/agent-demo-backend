import mongoose from "mongoose";
import { IMessages } from "@/db/models/ragChat/messages";
import { IFileUrls } from "@/modules/rag/utils/rag.types";
import { STATUS } from "@/enums";
import { SOURCE } from "@/modules/rag/utils/rag.enum";

const ObjectId = mongoose.Schema.Types.ObjectId;

export interface IChat {
  _id: mongoose.Types.ObjectId;
  userRef: mongoose.Types.ObjectId;
  title: string;
  messages: IMessages[];
  fileUrls: IFileUrls[];
  source: SOURCE;
  status: STATUS;
}

export interface IChatDocument extends IChat, Document {
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new mongoose.Schema<IChatDocument>(
  {
    userRef: {
      type: ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    fileUrls: [
      {
        fileName: { type: String, required: true },
        fileUrl: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        status: { type: String },
        size: { type: Number, default: 0 }, // file size in bytes,
      },
    ],
    messages: [{ type: ObjectId, ref: "Message" }],
    source: {
      type: String,
      default: SOURCE.BOTH,
    },
    status: {
      type: String,
      enum: Object.values(STATUS),
      default: STATUS.ACTIVE,
    },
  },
  { timestamps: true },
);

export const Chat = mongoose.model<IChatDocument>("Chat", ChatSchema);
