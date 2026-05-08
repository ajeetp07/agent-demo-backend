import { STATUS } from "@/enums";
import { SENDER_ROLE } from "@/modules/rag/utils/rag.enum";
import mongoose from "mongoose";

const ObjectId = mongoose.Schema.Types.ObjectId;

export interface IMessages {
  _id: mongoose.Types.ObjectId;
  chatRef: mongoose.Types.ObjectId;
  sender: SENDER_ROLE;
  text: string;
  msgId: string;
  tempAiMessageId: string;
  status: STATUS;
  createdAt: Date;
}

export interface IMessagesDocuments extends IMessages, Document {
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new mongoose.Schema<IMessagesDocuments>(
  {
    chatRef: {
      type: ObjectId,
      ref: "Chat",
      required: true,
    },
    sender: {
      type: String,
      enum: Object.values(SENDER_ROLE),
      required: true,
    },
    text: {
      type: String,
    },
    msgId: {
      type: String,
    },
    tempAiMessageId: {
      type: String,
    },
    status: {
      type: String,
      enum: Object.values(STATUS),
      default: STATUS.ACTIVE,
    },
  },
  { timestamps: true },
);

export const Messages = mongoose.model<IMessagesDocuments>(
  "Message",
  MessageSchema,
);
