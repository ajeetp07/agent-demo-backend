import { validationErrorHandler } from "@/helpers/validation-error";
import { SOURCE } from "@/modules/rag/utils/rag.enum";
import z from "zod";
import { validate } from "zod-express-validator";

// ==================== Schemas ====================

export const StreamBodySchema = z.object({
  chatId: z.string().min(1, "Chat ID is required"),
  query: z.string().min(1, "Query is required"),
  clientId: z.string().min(1, "Client ID is required"),
  aiMessageId: z.string().min(1, "AI Message ID is required"),
  filesToAdd: z.enum(SOURCE).optional(),
});

export const UpdateQueryBodySchema = z.object({
  id: z.string().min(1, "ID is required"),
  query: z.string().min(1, "Query is required"),
  clientId: z.string().min(1, "Client ID is required"),
  chatId: z.string().min(1, "Chat ID is required"),
});

export const FileUploadBodySchema = z.object({
  chatId: z.string().min(1, "Chat ID is required"),
  fileName: z.string().min(1, "File Name is required"),
  fileUrl: z.string().min(1, "File URL is required"),
  size: z.number().min(0, "Size must be a non-negative number"),
});

export const UploadMultipleFilesBodySchema = z.object({
  files: z
    .array(
      z.object({
        fileName: z.string().min(1, "File Name is required"),
        fileUrl: z.string().min(1, "File URL is required"),
        size: z.number().min(0, "Size must be a non-negative number"),
      }),
    )
    .min(1, "At least one file is required"),
});

export const SourceBodySchema = z.object({
  chatId: z.string().min(1, "Chat ID is required"),
  source: z.enum(SOURCE),
});

export const ChatIdParamSchema = z.object({
  id: z.string().min(1, "ID is required"),
});

// ==================== Validation Schemas ====================

const StreamValidationSchema = {
  body: StreamBodySchema,
} as const;

const UpdateQueryValidationSchema = {
  body: UpdateQueryBodySchema,
} as const;

const FileUploadValidationSchema = {
  body: FileUploadBodySchema,
} as const;

const UploadMultipleFilesValidationSchema = {
  body: UploadMultipleFilesBodySchema,
} as const;

const SourceValidationSchema = {
  body: SourceBodySchema,
} as const;

const ChatIdValidationSchema = {
  params: ChatIdParamSchema,
} as const;

const HistoryValidationSchema = {} as const;
const CreateChatValidationSchema = {
  body: z.object({
    source: z.enum(SOURCE).nullable().optional(),
  }),
} as const;

const UserKnowledgeBaseFilesValidationSchema = {} as const;
const CentralizedFilesFromAWSValidationSchema = {
  params: ChatIdParamSchema,
} as const;
const DeleteChatMessagesValidationSchema = {
  params: ChatIdParamSchema,
} as const;

// ==================== Validators ====================

const streamValidator = validate(
  StreamValidationSchema,
  validationErrorHandler,
);

const updateQueryValidator = validate(
  UpdateQueryValidationSchema,
  validationErrorHandler,
);

const fileUploadValidator = validate(
  FileUploadValidationSchema,
  validationErrorHandler,
);

const uploadMultipleFilesValidator = validate(
  UploadMultipleFilesValidationSchema,
  validationErrorHandler,
);

const sourceValidator = validate(
  SourceValidationSchema,
  validationErrorHandler,
);

const chatIdValidator = validate(
  ChatIdValidationSchema,
  validationErrorHandler,
);

const historyValidator = validate(
  HistoryValidationSchema,
  validationErrorHandler,
);

const createChatValidator = validate(
  CreateChatValidationSchema,
  validationErrorHandler,
);

const userKnowledgeBaseFilesValidator = validate(
  UserKnowledgeBaseFilesValidationSchema,
  validationErrorHandler,
);

const centralizedFilesFromAWSValidator = validate(
  CentralizedFilesFromAWSValidationSchema,
  validationErrorHandler,
);

const deleteChatMessagesValidator = validate(
  DeleteChatMessagesValidationSchema,
  validationErrorHandler,
);

export const ragValidators = {
  stream: streamValidator,
  updateQuery: updateQueryValidator,
  fileUpload: fileUploadValidator,
  uploadMultipleFiles: uploadMultipleFilesValidator,
  source: sourceValidator,
  chatId: chatIdValidator,
  history: historyValidator,
  createChat: createChatValidator,
  userKnowledgeBaseFiles: userKnowledgeBaseFilesValidator,
  centralizedFilesFromAWS: centralizedFilesFromAWSValidator,
  deleteChatMessages: deleteChatMessagesValidator,
};
