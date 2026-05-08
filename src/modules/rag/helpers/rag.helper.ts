import { CentralizedFile } from "@/db/models/ragChat/centralizedFile";
import { Chat } from "@/db/models/ragChat/chat";
import { Messages } from "@/db/models/ragChat/messages";
import { STATUS } from "@/enums";
import { fileStorageService } from "@/providers/file-storage";
import ragService from "@/modules/rag/core";
import { DocumentExtractorService } from "@/modules/rag/core/document-extractor";
import { RAG_QUERY_OPTIONS } from "@/modules/rag/utils/rag.constant";
import {
  DEFAULT_CHAT_TITLE,
  FILE_PROCESSING_STATUS,
  RAG_FILE_SCOPE,
  SENDER_ROLE,
  SOURCE,
} from "@/modules/rag/utils/rag.enum";
import {
  IUploadFile,
  TCentralizedFile,
  TChatsFilter,
  TFileCheckFilter,
  TGenerateAIResponse,
  TSingleChat,
  TStorePreferenceFilter,
  TUpdateFileData,
} from "@/modules/rag/utils/rag.types";
import { socketService } from "@/providers/socket";
import { TObjectId } from "@/types";
import { ObjectId } from "@/helpers/common";
import mime from "mime-types";
import path from "node:path";

export const getFileScope = (
  useChatFiles: boolean,
  useCentralizedFiles: boolean,
) => {
  if (useChatFiles && useCentralizedFiles) {
    return RAG_FILE_SCOPE.BOTH;
  } else if (useChatFiles) {
    return RAG_FILE_SCOPE.CHAT;
  }
  return RAG_FILE_SCOPE.CENTRALIZED;
};

/**
 * RagHelper class for handling RAG-related database operations and business logic
 */
class RagHelper {
  async findAll(userRef: TObjectId) {
    return Chat.find(
      { userRef: userRef, status: STATUS.ACTIVE },
      { userRef: 1, _id: 1, title: 1, createdAt: 1, updatedAt: 1, source: 1 },
    ).sort({ createdAt: -1 });
  }

  async singleChat({ chatId, userId }: TSingleChat) {
    return await Chat.findOne({ _id: chatId, userRef: userId }).populate(
      "messages",
    );
  }

  async updateFile({ chatId, fileName, fileUrl, size }: TUpdateFileData) {
    return Chat.findByIdAndUpdate(
      chatId,
      {
        $push: {
          fileUrls: {
            fileName,
            fileUrl,
            size,
            status: FILE_PROCESSING_STATUS.UPLOADED,
          },
        },
      },
      { new: true },
    );
  }

  async chats({ chatId, userRef }: TChatsFilter) {
    const chat = await Chat.findOne({ _id: chatId, userRef }).populate({
      path: "messages",
      model: "Message",
      options: { sort: { createdAt: 1 } },
    });

    if (!chat) {
      throw new Error("Chat not found with associate ID");
    }

    const fileMessages = chat?.fileUrls.map((file) => ({
      _id: file._id,
      sender: SENDER_ROLE.USER,
      fileUrl: file.fileUrl,
      fileName: file.fileName,
      fileSize: file.size,
      createdAt: file.createdAt,
    }));

    const combinedMessages = [...chat.messages, ...fileMessages].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    return combinedMessages;
  }

  async updateQueryAndAIResponse({
    query,
    userId,
    msgId,
    socketClientId,
    chatId,
  }: TGenerateAIResponse) {
    const chat = await Chat.findOne({ _id: chatId, userRef: userId });

    if (!chat || !chatId) {
      throw new Error("Chat not found for this user");
    }

    const userMessage = await Messages.findById(msgId);

    if (!userMessage || !msgId) {
      throw new Error("Message not found with associate msg id.");
    }

    userMessage.text = query;
    const aiMessage = await Messages.findOne({ msgId: msgId });

    if (!aiMessage) {
      throw new Error("AI message not found with associate msg id.");
    }

    const tempAiMessageId = aiMessage.tempAiMessageId;
    await userMessage.save();

    const sourceInfo = await this.getTheUserPreferenceSource({
      chatId: ObjectId(chatId),
      userId,
    });

    if (!sourceInfo) {
      throw new Error("No source information found for the chat");
    }

    const source = sourceInfo ? sourceInfo.source : null;

    let useCentralizedFiles: boolean = false;
    let useChatFiles: boolean = false;

    switch (source) {
      case SOURCE.CHAT:
        useChatFiles = true;
        break;
      case SOURCE.CENTRALIZED:
        useCentralizedFiles = true;
        break;
      case SOURCE.BOTH:
        useChatFiles = true;
        useCentralizedFiles = true;
        break;
      default:
        break;
    }

    await this.deleteMessagesAfterMessage({
      messageId: msgId,
      tempAiMessageId,
    });

    const fileScope =
      useChatFiles && useCentralizedFiles
        ? RAG_FILE_SCOPE.BOTH
        : useChatFiles
          ? RAG_FILE_SCOPE.CHAT
          : RAG_FILE_SCOPE.CENTRALIZED;

    ragService
      .query(query, RAG_QUERY_OPTIONS, {
        fileScope,
        userId: userId.toString(),
        chatId: chatId.toString(),
        tempAiMessageId,
        aiMessageId: aiMessage._id.toString(),
        socketClientId,
      })
      .catch(() => {
        socketService?.emitToRoom(socketClientId, "ai-response-error", {
          error: "Failed to generate response",
        });
      });

    return { userMessage };
  }

  async deleteChat(id: TObjectId) {
    const chat = await Chat.findById(id);

    if (!chat) {
      throw new Error("Chat not found with associated id");
    }

    const s3DeletionErrors: Error[] = [];
    if (chat.fileUrls && chat.fileUrls.length > 0) {
      const deletionPromises = chat.fileUrls.map(async (file) => {
        try {
          await fileStorageService.delete(file.fileName);
        } catch (error) {
          s3DeletionErrors.push(error as Error);
        }
      });
      await Promise.all(deletionPromises);
    }

    if (s3DeletionErrors.length > 0) {
      throw new Error(
        `Failed to delete some files from S3: ${s3DeletionErrors.map((e) => e.message).join(", ")}`,
      );
    }

    await Messages.updateMany(
      { chat: id, status: { $ne: STATUS.DELETED } },
      { $set: { status: STATUS.DELETED } },
    );

    const deletedChat = await Chat.findByIdAndUpdate(
      id,
      { $set: { status: STATUS.DELETED } },
      { new: true },
    );

    return deletedChat;
  }

  async getFiles(id: TObjectId) {
    return CentralizedFile.find({ userRef: id, status: STATUS.ACTIVE }).sort({
      createdAt: -1,
    });
  }

  async getFilesByIdAndDelete(id: TObjectId) {
    try {
      const file = await CentralizedFile.findById({ _id: id });

      if (!file) {
        throw new Error("files not associate with file id.");
      }

      try {
        await fileStorageService.delete(file.file.fileName);
      } catch {
        throw new Error(`S3 deletion failed for file ${file.file.fileName}`);
      }
      ragService.deleteDocument(file._id.toString());
      await CentralizedFile.findOneAndUpdate(
        { _id: id },
        { $set: { status: STATUS.DELETED } },
      );

      return { msg: "File deleted from AWS and MongoDB" };
    } catch {
      throw new Error("Failed to delete file");
    }
  }

  async storeUserPreferenceInChat({ chatId, source }: TStorePreferenceFilter) {
    return Chat.findByIdAndUpdate({ _id: chatId }, { source }, { new: true });
  }

  async getTheUserPreferenceSource({ chatId, userId }: TSingleChat) {
    return Chat.findOne(
      { _id: chatId, userRef: userId, status: STATUS.ACTIVE },
      { source: 1, _id: 1 },
    );
  }

  async fileCheck({ chatId, userId }: TFileCheckFilter) {
    const chatFiles = await Chat.findById({
      _id: chatId,
      status: STATUS.ACTIVE,
    }).select("fileUrls");

    const centralizedFiles = await CentralizedFile.find({
      userRef: userId,
      status: STATUS.ACTIVE,
    });

    return { chatFiles, centralizedFiles };
  }

  async generateResponse({
    chatId,
    query,
    userId,
    source,
    tempAiMessageId,
    socketClientId,
  }: TGenerateAIResponse) {
    try {
      socketService?.emitToRoom(socketClientId, "ai-analyzing-query", {
        message: "Analyzing your query...",
      });

      let chat = await this.singleChat({ chatId: ObjectId(chatId!), userId });

      if (!chat) {
        chat = new Chat({
          userRef: userId,
          title: DEFAULT_CHAT_TITLE.TITLE,
          source: source,
        });
      }

      const userMessage = new Messages({
        chatRef: chat._id,
        sender: SENDER_ROLE.USER,
        text: query,
      });

      chat.messages.push(userMessage);

      const aiMessage = new Messages({
        chatRef: chat._id,
        sender: SENDER_ROLE.ASSISTANT,
        text: "",
        msgId: userMessage._id,
        tempAiMessageId: tempAiMessageId,
      });

      await Promise.all([userMessage.save(), aiMessage.save()]);

      chat.messages.push(aiMessage);

      let useCentralizedFiles: boolean = false;
      let useChatFiles: boolean = false;

      if (source === SOURCE.CHAT) {
        useChatFiles = true;
      } else if (source === SOURCE.CENTRALIZED) {
        useCentralizedFiles = true;
      } else if (source === SOURCE.BOTH) {
        useChatFiles = true;
        useCentralizedFiles = true;
      }

      if (chat.title === DEFAULT_CHAT_TITLE.TITLE) {
        const generatedTitle =
          (await ragService.generateChatTitle(query)) ??
          DEFAULT_CHAT_TITLE.TITLE;
        chat.title = generatedTitle;
      }

      await chat.save();

      ragService.query(query, RAG_QUERY_OPTIONS, {
        fileScope: getFileScope(useChatFiles, useCentralizedFiles),
        userId: userId.toString(),
        chatId: chatId!.toString(),
        tempAiMessageId,
        aiMessageId: aiMessage._id.toString(),
        socketClientId,
      });

      return {
        chatId: chat._id.toString(),
        userMessageId: userMessage._id.toString(),
        aiMessageId: aiMessage._id.toString(),
      };
    } catch (error) {
      console.log("[Generate AI Response] Error", error);
      socketService?.emitToRoom(socketClientId, "ai-response-error", {
        error: "Failed to start streaming session",
      });
    }
  }

  async updateFileStatus({
    fileName,
    fileUrl,
    status,
  }: Omit<TCentralizedFile, "size">) {
    await CentralizedFile.findOneAndUpdate(
      { "file.fileUrl": fileUrl, "file.fileName": fileName },
      { $set: { "file.status": status } },
      { new: true },
    );
  }

  async createChat(userRef: TObjectId, source?: string | null) {
    const chatData = {
      userRef,
      title: DEFAULT_CHAT_TITLE.TITLE,
      source: source || SOURCE.BOTH,
    };

    const chat = new Chat(chatData);

    return chat.save();
  }

  async deleteMessagesAfterMessage({
    messageId,
    tempAiMessageId,
  }: {
    messageId: string;
    tempAiMessageId: string;
  }) {
    const targetMessage = await Messages.findOne({
      _id: messageId,
    });

    if (!targetMessage) {
      throw new Error("Target message not found");
    }

    const chatId = targetMessage.chatRef;

    // Delete all messages in the same chat that were created after the target message
    const deleteResult = await Messages.deleteMany({
      chatRef: chatId,
      tempAiMessageId: { $ne: tempAiMessageId },
      _id: { $ne: messageId },
      createdAt: { $gt: targetMessage.createdAt },
    });

    return deleteResult.deletedCount;
  }

  async deleteMessages(chatId: string) {
    return Messages.deleteMany({ chatRef: chatId });
  }

  async uploadFile({
    fileUrl,
    fileName,
    documentId,
    userId,
    chatId,
    fileScope,
  }: IUploadFile) {
    try {
      socketService?.emit("file-processing-status", {
        status: FILE_PROCESSING_STATUS.EXTRACTING,
        fileName,
        fileUrl,
      });

      await this.updateFileStatus({
        fileName,
        fileUrl,
        status: FILE_PROCESSING_STATUS.EXTRACTING,
      });

      const response = await fetch(fileUrl);
      const data = await response.arrayBuffer();
      const fileBuffer = Buffer.from(data);

      //  Detect file type
      const fileExtension = path.extname(fileName);
      const fileType = mime.lookup(fileExtension);

      const extractor = new DocumentExtractorService();

      if (!fileType || !extractor.isSupportedFileType(String(fileType))) {
        throw new Error("Unsupported file type");
      }

      const extractedText = await extractor.extractText(fileBuffer, fileType);

      await ragService.ingestDocument({
        document: {
          id: documentId,
          content: extractedText,
          metadata: {
            fileName,
            fileUrl,
          },
        },
        userId,
        chatId,
        fileScope,
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    }
  }
}

export const ragHelper = new RagHelper();
