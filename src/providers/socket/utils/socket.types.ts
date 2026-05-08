import { Server as SocketIOServer, Socket } from "socket.io";
import { SENDER_ROLE } from "@/modules/rag/utils/rag.enum";

/**
 * Define all events your Socket.IO server can emit.
 * Extend this as your app grows.
 */
export interface ServerToClientEvents {
  "file-processing-status": (payload: IFileProcessingStatusPayload) => void;
  "ai-response-chunk": (data: IAiResponseStreamPayload) => void;
  "ai-response-complete": (data: IAiResponseCompletePayload) => void;
  "ai-analyzing-query": (data: Record<string, unknown>) => void;
  "ai-response-error": (data: Record<string, unknown>) => void;
  "update-notifications-count": () => void;
}

/**
 * Define all events the server listens to from the client.
 * Extend this for custom client events.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ClientToServerEvents {
  //   "join-room": (roomId: string) => void;
  //   "leave-room"?: (roomId: string) => void;
}

export type TypedSocketIO = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents
>;

export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface IFileProcessingStatusPayload {
  status: string;
  fileName: string;
  fileUrl: string;
  timestamp?: Date;
}

export interface IAiResponseStreamPayload {
  chunk: string;
  tempAiMessageId: string;
  messageId: string;
  chatId: string;
  sender: SENDER_ROLE;
}

export interface IAiResponseCompletePayload {
  fullResponse: string;
  tempAiMessageId: string;
  messageId: string;
  chatId: string;
}
