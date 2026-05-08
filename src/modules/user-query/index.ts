import { Router } from "express";
import { Middleware } from "@/middleware/auth";
import { UserQueryController } from "@/modules/user-query/user-query.controller";
import { userQueryValidators } from "@/modules/user-query/utils/user-query.validation";
import { UserQueryAdminController } from "./user-query-admin.controller";

const middleware = new Middleware();

export class UserQueryRouter {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.use(middleware.authMiddleware);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    const controller = new UserQueryController();

    this.router.get(
      "/:id",
      userQueryValidators.getUserQueryById,
      controller.getById,
    );
    this.router.get(
      "/",
      userQueryValidators.getAllUserQueries,
      controller.getAllUserQueries,
    );
    this.router.post(
      "/",
      userQueryValidators.createUserQuery,
      controller.create,
    );
  }
}

export class AdminUserQueryRouter {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.use(middleware.authMiddleware);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    const adminController = new UserQueryAdminController();

    this.router.post(
      "/email/:queryId",
      userQueryValidators.sendEmail,
      adminController.sendEmail,
    );

    this.router.put("/:id", userQueryValidators.update, adminController.update);

    this.router.delete(
      "/:id",
      userQueryValidators.delete,
      adminController.delete,
    );
  }
}
