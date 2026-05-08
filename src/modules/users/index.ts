import { Middleware } from "@/middleware/auth";
import { UserAdminController } from "@/modules/users/admin.controller";
import { UserController } from "@/modules/users/users.controller";
import { userValidators } from "@/modules/users/utils/users.validation";
import { Router } from "express";
import { SuperAdminUsersController } from "./super-admin.controller";

const middleware = new Middleware();

export class UserRouter {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.use(middleware.authMiddleware);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    const controller = new UserController();

    this.router.get("/me", userValidators.me, controller.me);

    this.router.put(
      "/profile",
      userValidators.updateProfile,
      controller.updateProfile,
    );

    this.router.post(
      "/change-password",
      userValidators.changePassword,
      controller.changePassword,
    );
  }
}

export class AdminUsersRouter {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.use(middleware.adminMiddleware);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    const controller = new UserAdminController();

    this.router.get("/", userValidators.getUsers, controller.get);
    this.router.get("/dashboard-metrics", controller.getDashboardMetrics);
    this.router.get(
      "/user-analytics",
      userValidators.userAnalytics,
      controller.getUserAnalytics,
    );
    this.router.get("/:id", userValidators.getOne, controller.getOne);
    this.router.put(
      "/status/:id",
      userValidators.updateStatus,
      controller.updateStatus,
    );
    this.router.put(
      "/user-role/:id",
      userValidators.changeUserRole,
      controller.changeUserRole,
    );
    this.router.put(
      "/force-password-change/:id",
      userValidators.forcePasswordChange,
      controller.forcePasswordChange,
    );
    this.router.put(
      "/force-password-change/company/:id",
      userValidators.forcePasswordChangeByCompany,
      controller.forcePasswordChangeByCompany,
    );
  }
}

export class SuperAdminUsersRouter {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.use(middleware.superAdminMiddleware);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    const controller = new SuperAdminUsersController();

    this.router.put(
      "/user-profile/:id",
      userValidators.updateUserProfile,
      controller.updateUserProfile,
    );
    this.router.post(
      "/change-password/:id",
      userValidators.changeUserPassword,
      controller.changeUserPassword,
    );
  }
}
