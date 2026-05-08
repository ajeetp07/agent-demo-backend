import { Middleware } from "@/middleware/auth";
import { ReferralsController } from "@/modules/referrals/referrals.controller";
import { referralValidators } from "@/modules/referrals/utils/referrals.validation";
import { Router } from "express";
import { SuperAdminReferralController } from "@/modules/referrals/referrals-super-admin.controller";

const middleware = new Middleware();

export class ReferralRouter {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.use(middleware.authMiddleware);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    const controller = new ReferralsController();

    this.router.get(
      "/",
      referralValidators.getAllReferrals,
      controller.getAllReferrals,
    );
    this.router.post(
      "/apply",
      referralValidators.applyReferral,
      controller.applyReferral,
    );
    this.router.post(
      "/redeem/:id",
      referralValidators.redeemReferral,
      controller.redeemReferral,
    );
    this.router.post(
      "/invite",
      referralValidators.sendReferralInvite,
      controller.sendReferralInvite,
    );
  }
}

export class SuperAdminReferralRouter {
  router: Router;

  constructor() {
    this.router = Router();

    this.initializeRoutes();
  }

  private initializeRoutes() {
    const superAdminController = new SuperAdminReferralController();

    this.router.get(
      "/metrics",
      referralValidators.getReferralMetrics,
      superAdminController.getReferralMetrics,
    );
    this.router.get(
      "/activity",
      referralValidators.getActivityChart,
      superAdminController.getActivityChart,
    );
    this.router.get(
      "/rewards",
      referralValidators.getRewardsIssuedChart,
      superAdminController.getRewardsIssuedChart,
    );
  }
}
