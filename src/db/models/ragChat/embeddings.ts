import { RAG_FILE_SCOPE } from "@/modules/rag/utils/rag.enum";
import mongoose, { Document as MongooseDocument, Schema } from "mongoose";

export interface IVectorEmbeddingsDocument extends MongooseDocument {
  id: string;
  content: string;
  contextualizedContent: string;
  embedding?: number[];
  documentId: string;
  orderIndex: number;
  metadata?: Record<string, any>;
  userId: mongoose.Types.ObjectId;
  chatId: mongoose.Types.ObjectId;
  fileScope: RAG_FILE_SCOPE;
  createdAt: Date;
  updatedAt: Date;
}

// Define the Mongoose schema
const ChunkSchema = new Schema<IVectorEmbeddingsDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    contextualizedContent: {
      type: String,
      required: true,
      index: "text", // For text search capabilities
    },
    embedding: {
      type: [Number],
      required: false,
    },
    orderIndex: {
      type: Number,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: false,
    },
    documentId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "User",
    },
    chatId: {
      type: Schema.Types.ObjectId,
      required: false,
      index: true,
      ref: "Chat",
    },
    fileScope: {
      type: String,
      enum: Object.values(RAG_FILE_SCOPE),
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "vector_embeddings",
  },
);

ChunkSchema.index({ userId: 1, fileScope: 1 }, { unique: false });

export const VectorEmbeddingsModel = mongoose.model<IVectorEmbeddingsDocument>(
  "vector_embeddings",
  ChunkSchema,
);
