import { Middleware } from "@/middleware/auth";
import { ChatController } from "@/modules/chat/chat.controller";
import { chatValidators } from "@/modules/chat/utils/chat.validation";
import { Router } from "express";

const middleware = new Middleware();

export class ChatRouter {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.use(middleware.authMiddleware);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    const controller = new ChatController();

    this.router.get("/users", chatValidators.getUsers, controller.getUsers);
    this.router.get(
      "/channels",
      chatValidators.getChannelList,
      controller.getChannelList,
    );

    this.router.post(
      "/auth",
      chatValidators.generateToken,
      controller.generateToken,
    );
    this.router.post(
      "/direct",
      chatValidators.createDirectChat,
      controller.createDirectChat,
    );
    this.router.post(
      "/group",
      chatValidators.createGroupChat,
      controller.createGroupChat,
    );
    this.router.post(
      "/group/add-member",
      chatValidators.addMemberInGroup,
      controller.addMemberInGroup,
    );
    this.router.post(
      "/group/remove-member",
      chatValidators.removeMemberFromGroup,
      controller.removeMemberFromGroup,
    );
    this.router.post(
      "/upload",
      chatValidators.uploadFile,
      controller.uploadFile,
    );
    this.router.post(
      "/notify",
      chatValidators.sendNotification,
      controller.sendNotification,
    );

    this.router.put(
      "/group/change-role",
      chatValidators.updateRoleOfGroupMember,
      controller.updateRoleOfGroupMember,
    );

    this.router.delete(
      "/file",
      chatValidators.deleteFile,
      controller.deleteFile,
    );
  }
}
