import { Middleware } from "@/middleware/auth";
import { StripePaymentController } from "@/modules/stripe-payment/stripe-payment.controller";
import { StripePaymentAdminController } from "@/modules/stripe-payment/stripe-payment-admin.controller";
import { stripePaymentValidators } from "@/modules/stripe-payment/utils/stripe-payment.validation";
import { Router } from "express";

const middleware = new Middleware();

export class StripePaymentRouter {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.use(middleware.authMiddleware);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    const controller = new StripePaymentController();

    this.router.get(
      "/product",
      stripePaymentValidators.product,
      controller.product,
    );

    // `stripe transaction` routes
    this.router.get(
      "/orders",
      stripePaymentValidators.pastOrders,
      controller.pastOrders,
    );
    this.router.get("/orders/count", controller.ordersCount);
    this.router.post(
      "/refund/:id",
      stripePaymentValidators.refundOrder,
      controller.refundOrder,
    );

    // `stripe checkout` routes
    this.router.post(
      "/create-checkout-session",
      stripePaymentValidators.createCheckoutSession,
      controller.createCheckoutSession,
    );
    this.router.get(
      "/session-status",
      stripePaymentValidators.sessionStatus,
      controller.retrieveCheckoutSession,
    );
  }
}

export class AdminStripePaymentRouter {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.use(middleware.adminMiddleware);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    const adminController = new StripePaymentAdminController();

    // `stripe payment product` routes
    this.router.post(
      "/product",
      stripePaymentValidators.createProduct,
      adminController.createProduct,
    );
    this.router.put(
      "/product/:id",
      stripePaymentValidators.editProduct,
      adminController.editProduct,
    );
    this.router.delete(
      "/product/:id",
      stripePaymentValidators.deleteProduct,
      adminController.deleteProduct,
    );

    // `stripe payment earnings` routes
    this.router.get(
      "/earning-chart",
      stripePaymentValidators.getEarningChart,
      adminController.getEarningChart,
    );

    // `stripe coupon` routes
    this.router.post(
      "/coupon",
      stripePaymentValidators.createCoupon,
      adminController.createCoupon,
    );
    this.router.get(
      "/coupon",
      stripePaymentValidators.listCoupons,
      adminController.listCoupons,
    );
    this.router.get(
      "/coupon/:couponId",
      stripePaymentValidators.getCoupon,
      adminController.getCoupon,
    );
    this.router.put(
      "/coupon/:couponId",
      stripePaymentValidators.editCoupon,
      adminController.editCoupon,
    );
    this.router.delete(
      "/coupon/:couponId",
      stripePaymentValidators.deleteCoupon,
      adminController.deleteCoupon,
    );

    // `stripe promotion code` routes
    this.router.post(
      "/promotion-code",
      stripePaymentValidators.createPromotionCode,
      adminController.createPromotionCode,
    );
    this.router.get(
      "/promotion-code/:couponId",
      stripePaymentValidators.listPromotionCodes,
      adminController.listPromotionCodes,
    );
    this.router.put(
      "/promotion-code/:promotionCodeId",
      stripePaymentValidators.updatePromotionCode,
      adminController.updatePromotionCode,
    );

    // `stripe payment transactions` routes
    this.router.get(
      "/transactions",
      stripePaymentValidators.getTransactions,
      adminController.getTransactions,
    );
    this.router.get(
      "/transactions/count",
      stripePaymentValidators.countTransactions,
      adminController.countTransactions,
    );
    this.router.get(
      "/transactions/export",
      stripePaymentValidators.exportTransactions,
      adminController.exportTransactions,
    );
  }
}
