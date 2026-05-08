import { IRetrievalOptions } from "@/modules/rag/utils/rag.types";

export const RAG_MESSAGES = {
  WEBSOCKET_NOT_AVAILABLE: "WebSocket server not available",
  CLIENT_NOT_CONNECTED: "Client not connected via WebSocket",
  NO_SOURCE_INFO: "No source information found for the chat",
  STREAMING_STARTED: "Streaming started",
  CHAT_NOT_FOUND: "Chat not found",
  CHAT_RETRIEVED: "Chat retrieved successfully.",
  SUCCESS: "Success.",
  FILE_ADDED: "File added to chat successfully",
  FILES_UPLOADED: "Files uploaded to central database successfully",
  NO_FILES_FOUND: "No files found for this user",
  FILES_RETRIEVED: "Files retrieved to central database successfully",
  FILE_INFO_RECEIVED: "Receive the file information",
  USER_PREFERENCE_STORED: "Store user preference",
  USER_PREFERENCE_RETRIEVED: "user preference",
  FILES_DELETED: "Centralized files deleted",
  CHAT_MESSAGES_DELETED: "Chat messages",
} as const;

export const RAG_QUERY_OPTIONS: IRetrievalOptions = {
  useEmbeddings: true,
  useBM25: false,
  useReranking: false,
  topK: 10,
  initialRetrievalCount: 15,
};

export const RECIPROCAL_RANK_FUSION_K = 60;

export const CHUNKING_OPTIONS = {
  chunkSize: 1000,
  chunkOverlap: 200,
};
