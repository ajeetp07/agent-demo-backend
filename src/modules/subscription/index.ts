import { Middleware } from "@/middleware/auth";
import { SubscriptionAdminController } from "@/modules/subscription/subscription-admin.controller";
import { SubscriptionSuperAdminController } from "@/modules/subscription/subscription-super-admin.controller";
import { subscriptionValidators } from "@/modules/subscription/utils/subscription.validation";
import { Router } from "express";

const middleware = new Middleware();

export class AdminSubscriptionRouter {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.use(middleware.adminMiddleware);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    const adminController = new SubscriptionAdminController();

    this.router.get("/plans", adminController.getAllStripeSubscriptionPlans);
    this.router.get("/", adminController.getUserPlans);

    this.router.post("/customer/create", adminController.createStripeCustomer);
    this.router.post(
      "/",
      subscriptionValidators.createSubscription,
      adminController.createSubscription,
    );
    this.router.put(
      "/cancel",
      subscriptionValidators.cancelSubscription,
      adminController.cancelSubscription,
    );
    this.router.post(
      "/plans",
      subscriptionValidators.changeSubscription,
      adminController.changeSubscription,
    );
  }
}

export class SuperAdminSubscriptionRouter {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.use(middleware.superAdminMiddleware);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    const superAdminController = new SubscriptionSuperAdminController();

    this.router.get(
      "/",
      subscriptionValidators.getAllSubscribedUsers,
      superAdminController.getAllSubscribedUsers,
    );
  }
}
