import { Router } from "express";

import { Middleware } from "@/middleware/auth";
import { RagController } from "@/modules/rag/rag.controller";
import { ragValidators } from "@/modules/rag/utils/rag.validation";

const middleware = new Middleware();

export class RagChatRouter {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.use(middleware.adminMiddleware);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    const controller = new RagController();

    // Get all routes
    this.router.get(
      "/centralized-files",
      ragValidators.userKnowledgeBaseFiles,
      controller.userKnowledgeBaseFiles,
    );
    this.router.get("/check/:id", ragValidators.chatId, controller.checkFiles);
    this.router.get(
      "/knowledge/preference/:id",
      ragValidators.chatId,
      controller.chatSource,
    );
    this.router.get("/", ragValidators.history, controller.history);
    this.router.get("/:id", ragValidators.chatId, controller.chatRetrieve);

    // POST All routes
    this.router.post("/stream", ragValidators.stream, controller.stream);
    this.router.post("/new", ragValidators.createChat, controller.create);
    this.router.post(
      "/add-file",
      ragValidators.fileUpload,
      controller.fileUpload,
    );
    this.router.post(
      "/centralized-file-upload",
      ragValidators.uploadMultipleFiles,
      controller.uploadMultipleFiles,
    );
    this.router.post("/store-source", ragValidators.source, controller.source);

    // PUT routes
    this.router.put("/", ragValidators.updateQuery, controller.updateQuery);

    // DELETE routes
    this.router.delete(
      "/files/:id",
      ragValidators.centralizedFilesFromAWS,
      controller.centralizedFilesFromAWS,
    );
    this.router.delete(
      "/messages/:id",
      ragValidators.deleteChatMessages,
      controller.deleteChatMessages,
    );
    this.router.delete("/:id", ragValidators.chatId, controller.chat);
  }
}
