import { Router } from "express";
import { Middleware } from "@/middleware/auth";
import { InviteUserController } from "@/modules/invite-user/invite-user.controller";
import { inviteUserValidators } from "@/modules/invite-user/utils/invite-user.validation";

const middleware = new Middleware();

export class AdminInviteUserRouter {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.use(middleware.adminMiddleware);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    const controller = new InviteUserController();

    this.router.post(
      "/users",
      inviteUserValidators.inviteMultipleUsers,
      controller.inviteMultipleUsers,
    );
    this.router.get(
      "/",
      inviteUserValidators.getInvitedUsers,
      controller.getInvitedUsers,
    );
    this.router.get(
      "/users/",
      inviteUserValidators.getUsersWithAcceptedInvitation,
      controller.getUsersWithAcceptedInvitation,
    );
    this.router.get(
      "/users-count",
      inviteUserValidators.getUsersCount,
      controller.getUsersCount,
    );
    this.router.post(
      "/resend-invite",
      inviteUserValidators.resendInvites,
      controller.resendInvites,
    );
    this.router.post(
      "/cancel-invite/:id",
      inviteUserValidators.cancelInvite,
      controller.cancelInvite,
    );
    this.router.post(
      "/:id",
      inviteUserValidators.softDeleteUsers,
      controller.softdeleteUsers,
    );
  }
}
