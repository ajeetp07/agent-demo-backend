import {
  CentralizedFile,
  ICentralizedFile,
} from "@/db/models/ragChat/centralizedFile";
import { ragHelper } from "@/modules/rag/helpers/rag.helper";
import { socketService, SocketService } from "@/providers/socket";
import { SuccessResponse } from "@/helpers/api-response";
import { ObjectId } from "@/helpers/common";
import {
  FILE_PROCESSING_STATUS,
  RAG_FILE_SCOPE,
} from "@/modules/rag/utils/rag.enum";
import { RAG_MESSAGES } from "@/modules/rag/utils/rag.constant";
import httpStatus from "http-status";
import { TRagController } from "@/modules/rag/utils/rag.types";

/**
 * RagController class for handling RAG-related HTTP requests
 */
export class RagController {
  /**
   * Stream RAG response
   */
  stream: TRagController["stream"] = async (req, res, next) => {
    try {
      const { chatId, query, clientId, aiMessageId, filesToAdd } = req.body;
      const userId = req.user!._id;

      // Get the Socket.IO instance from your service
      const io = SocketService.getIO();

      if (!io) {
        return SuccessResponse(res, httpStatus.BAD_REQUEST, {
          message: RAG_MESSAGES.WEBSOCKET_NOT_AVAILABLE,
        });
      }

      const clientSocket = SocketService.getClientSocket(clientId);

      if (!clientSocket) {
        return SuccessResponse(res, httpStatus.BAD_REQUEST, {
          message: RAG_MESSAGES.CLIENT_NOT_CONNECTED,
        });
      }

      const sourceInfo = await ragHelper.getTheUserPreferenceSource({
        chatId: ObjectId(chatId) as any,
        userId,
      });

      if (!sourceInfo) {
        return SuccessResponse(res, httpStatus.BAD_REQUEST, {
          message: RAG_MESSAGES.NO_SOURCE_INFO,
        });
      }

      const source = sourceInfo ? sourceInfo.source : undefined;

      // Start streaming process
      const data = await ragHelper.generateResponse({
        chatId,
        query,
        userId,
        source: filesToAdd || source,
        tempAiMessageId: aiMessageId,
        socketClientId: clientId,
      });

      return SuccessResponse(res, httpStatus.OK, {
        message: RAG_MESSAGES.STREAMING_STARTED,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Retrieve a chat by ID
   */
  chatRetrieve: TRagController["chatId"] = async (req, res, next) => {
    try {
      const chatId = req.params.id;
      const userRef = req.user!._id;

      const chat = await ragHelper.chats({
        chatId: ObjectId(chatId),
        userRef,
      });

      if (!chat) {
        return SuccessResponse(res, httpStatus.NOT_FOUND, {
          message: RAG_MESSAGES.CHAT_NOT_FOUND,
        });
      }

      return SuccessResponse(res, httpStatus.OK, {
        message: RAG_MESSAGES.CHAT_RETRIEVED,
        data: chat,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update query and regenerate AI response
   */
  updateQuery: TRagController["updateQuery"] = async (req, res, next) => {
    try {
      const userId = req.user!._id;
      const { id: msgId, query, clientId, chatId } = req.body;

      await ragHelper.updateQueryAndAIResponse({
        query,
        userId,
        msgId,
        chatId,
        socketClientId: clientId,
      });

      return SuccessResponse(res, httpStatus.OK, {
        message: RAG_MESSAGES.STREAMING_STARTED,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get chat history
   */
  history: TRagController["history"] = async (req, res, next) => {
    try {
      const userRef = req.user!._id;

      const data = await ragHelper.findAll(userRef);

      return SuccessResponse(res, httpStatus.OK, {
        message: RAG_MESSAGES.SUCCESS,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create a new chat
   */
  create: TRagController["createChat"] = async (req, res, next) => {
    try {
      const { source } = req.body;
      const userRef = req.user!._id;

      const chat = await ragHelper.createChat(userRef, source);

      return SuccessResponse(res, httpStatus.OK, {
        message: RAG_MESSAGES.SUCCESS,
        data: chat,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete a chat
   */
  chat: TRagController["chatId"] = async (req, res, next) => {
    try {
      const { id } = req.params;

      const deletedChat = await ragHelper.deleteChat(ObjectId(id));

      return SuccessResponse(res, httpStatus.OK, {
        message: RAG_MESSAGES.SUCCESS,
        data: deletedChat,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Upload a file to a chat
   */
  fileUpload: TRagController["fileUpload"] = async (req, res, next) => {
    try {
      const userId = req.user!._id;
      const { chatId, fileName, fileUrl, size } = req.body;

      const updatedChat = await ragHelper.updateFile({
        chatId: ObjectId(chatId),
        fileName,
        fileUrl,
        size,
      });

      if (!updatedChat) {
        return SuccessResponse(res, httpStatus.NOT_FOUND, {
          message: RAG_MESSAGES.CHAT_NOT_FOUND,
        });
      }

      const file = updatedChat.fileUrls.find(
        (file) => file.fileUrl === fileUrl,
      );

      await ragHelper.uploadFile({
        fileName,
        fileUrl,
        documentId: file?._id?.toString() || `${chatId}-${Date.now()}`,
        userId: userId.toString(),
        chatId,
        fileScope: RAG_FILE_SCOPE.CHAT,
      });

      return SuccessResponse(res, httpStatus.OK, {
        message: RAG_MESSAGES.FILE_ADDED,
        data: updatedChat,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Upload multiple files to centralized storage
   */
  uploadMultipleFiles: TRagController["uploadMultipleFiles"] = async (
    req,
    res,
    next,
  ) => {
    try {
      const { files } = req.body;
      const userId = req.user!._id;

      const centralizedFiles = (
        await CentralizedFile.insertMany(
          files.map((file: any) => ({
            userRef: userId,
            file: {
              fileName: file.fileName,
              fileUrl: file.fileUrl,
              status: FILE_PROCESSING_STATUS.UPLOADED,
              size: file.size || 0,
            },
          })),
        )
      ).map((doc) => doc.toObject() as ICentralizedFile);

      Promise.all(
        centralizedFiles.map(async ({ file, _id }: ICentralizedFile) => {
          const { fileName, fileUrl } = file;

          try {
            await ragHelper.uploadFile({
              fileName,
              fileUrl,
              documentId: _id.toString(),
              userId: req.user!._id.toString(),
              chatId: undefined,
              fileScope: RAG_FILE_SCOPE.CENTRALIZED,
            });
          } catch {
            socketService.emit("file-processing-status", {
              status: FILE_PROCESSING_STATUS.FAILED_TO_PROCESS_FILE,
              fileName,
              fileUrl,
            });
          }
        }),
      );

      return SuccessResponse(res, httpStatus.OK, {
        message: RAG_MESSAGES.FILES_UPLOADED,
        data: centralizedFiles,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user's knowledge base files
   */
  userKnowledgeBaseFiles: TRagController["userKnowledgeBaseFiles"] = async (
    req,
    res,
    next,
  ) => {
    try {
      const id = req.user!._id;

      const data = await ragHelper.getFiles(id);

      if (!data) {
        return SuccessResponse(res, httpStatus.NOT_FOUND, {
          message: RAG_MESSAGES.NO_FILES_FOUND,
        });
      }

      return SuccessResponse(res, httpStatus.OK, {
        message: RAG_MESSAGES.FILES_RETRIEVED,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Check if chat has files
   */
  checkFiles: TRagController["chatId"] = async (req, res, next) => {
    try {
      const userId = req.user!._id;
      const chatId = req.params.id;

      const { chatFiles, centralizedFiles } = await ragHelper.fileCheck({
        chatId: ObjectId(chatId),
        userId,
      });

      const data = {
        hasChatFiles: (chatFiles?.fileUrls?.length ?? 0) > 0,
        hasCentralizedFiles: (centralizedFiles.length ?? 0) > 0,
      };

      return SuccessResponse(res, httpStatus.OK, {
        message: RAG_MESSAGES.FILE_INFO_RECEIVED,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Store user's source preference
   */
  source: TRagController["source"] = async (req, res, next) => {
    try {
      const chatId = req.body.chatId;
      const source = req.body.source;

      const data = await ragHelper.storeUserPreferenceInChat({
        chatId: ObjectId(chatId),
        source,
      });

      return SuccessResponse(res, httpStatus.OK, {
        message: RAG_MESSAGES.USER_PREFERENCE_STORED,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user's source preference for a chat
   */
  chatSource: TRagController["chatId"] = async (req, res, next) => {
    try {
      const chatId = req.params.id;
      const userId = req.user!._id;

      const data = await ragHelper.getTheUserPreferenceSource({
        chatId: ObjectId(chatId),
        userId,
      });

      return SuccessResponse(res, httpStatus.OK, {
        message: RAG_MESSAGES.USER_PREFERENCE_RETRIEVED,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete centralized files from AWS
   */
  centralizedFilesFromAWS: TRagController["centralizedFilesFromAWS"] = async (
    req,
    res,
    next,
  ) => {
    try {
      const fileId = req.params.id;

      const Files = await ragHelper.getFilesByIdAndDelete(ObjectId(fileId));

      return SuccessResponse(res, httpStatus.OK, {
        message: RAG_MESSAGES.FILES_DELETED,
        data: Files,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete chat messages
   */
  deleteChatMessages: TRagController["deleteChatMessages"] = async (
    req,
    res,
    next,
  ) => {
    try {
      const chatId = req.params.id;

      const data = await ragHelper.deleteMessages(chatId);

      return SuccessResponse(res, httpStatus.OK, {
        message: RAG_MESSAGES.CHAT_MESSAGES_DELETED,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
