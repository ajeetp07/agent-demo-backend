import { Middleware } from "@/middleware/auth";
import { StripeConnectController } from "@/modules/stripe-connect/stripe-connect.controller";
import { StripeConnectAdminController } from "@/modules/stripe-connect/stripe-connect-admin.controller";
import { StripeConnectSuperAdminController } from "@/modules/stripe-connect/stripe-connect-super-admin.controller";
import { stripeConnectValidators } from "@/modules/stripe-connect/utils/stripe-connect.validation";
import { Router } from "express";

const middleware = new Middleware();

export class StripeConnectRouter {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.use(middleware.authMiddleware);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    const controller = new StripeConnectController();

    // `stripe connect customer` routes
    this.router.post("/customer", controller.createCustomer);
    this.router.get("/customer", controller.getCustomer);

    // `stripe connect products` routes
    this.router.get(
      "/product",
      stripeConnectValidators.product,
      controller.product,
    );

    // `stripe connect transaction` routes
    this.router.post(
      "/create-payment-intent",
      stripeConnectValidators.createPaymentIntent,
      controller.createPaymentIntent,
    );
    this.router.get(
      "/past-orders",
      stripeConnectValidators.pastOrders,
      controller.pastOrders,
    );
    this.router.get("/past-orders/count", controller.pastOrdersCount);
    this.router.post(
      "/refund/:id",
      stripeConnectValidators.refundOrder,
      controller.refundOrder,
    );
  }
}

export class AdminStripeConnectRouter {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.use(middleware.adminMiddleware);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    const adminController = new StripeConnectAdminController();

    // `stripe connect vendor` routes
    this.router.get(
      "/vendor-details",
      stripeConnectValidators.vendorDetails,
      adminController.vendorDetails,
    );
    this.router.post(
      "/account",
      stripeConnectValidators.createAccount,
      adminController.createAccount,
    );
    this.router.post(
      "/account-session",
      stripeConnectValidators.createAccountSession,
      adminController.createAccountSession,
    );
    this.router.post(
      "/express-dashboard",
      stripeConnectValidators.createDashboardLink,
      adminController.createDashboardLink,
    );
    this.router.get(
      "/transferred-transactions",
      stripeConnectValidators.transferredTransactions,
      adminController.transferredTransactions,
    );
    this.router.get(
      "/all-transactions",
      stripeConnectValidators.getAllTransactions,
      adminController.getAllTransactions,
    );
    this.router.get(
      "/earning-details",
      stripeConnectValidators.getEarningDetails,
      adminController.getEarningDetails,
    );

    // `stripe connect product` routes
    this.router.post(
      "/product",
      stripeConnectValidators.createProduct,
      adminController.createProduct,
    );
    this.router.put(
      "/product/:id",
      stripeConnectValidators.editProduct,
      adminController.editProduct,
    );
    this.router.delete(
      "/product/:id",
      stripeConnectValidators.deleteProduct,
      adminController.deleteProduct,
    );

    // charts related end points
    this.router.get(
      "/earnings",
      stripeConnectValidators.getEarnings,
      adminController.getEarnings,
    );

    this.router.get(
      "/transactions",
      stripeConnectValidators.getTransactionDetails,
      adminController.getTransactionDetails,
    );
    this.router.get(
      "/transactions/count",
      stripeConnectValidators.countTransactionByStatus,
      adminController.countTransactionByStatus,
    );
    this.router.get(
      "/transactions/export",
      stripeConnectValidators.exportTransactions,
      adminController.exportTransactions,
    );
  }
}

export class SuperAdminStripeConnectRouter {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.use(middleware.superAdminMiddleware);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    const superAdminController = new StripeConnectSuperAdminController();

    // Stripe transactions (includes stripe payment, stripe connect, stripe subscriptions etc.)
    this.router.get(
      "/stripe-transactions",
      stripeConnectValidators.getTransactions,
      superAdminController.getTransactions,
    );
    this.router.get(
      "/stripe-transactions/count",
      stripeConnectValidators.countTransactions,
      superAdminController.countTransactions,
    );
    this.router.get(
      "/stripe-transactions/export",
      stripeConnectValidators.exportTransactions,
      superAdminController.exportTransactions,
    );

    // Vendor management routes
    this.router.get(
      "/vendors",
      stripeConnectValidators.getAllVendors,
      superAdminController.getAllVendors,
    );
    this.router.put(
      "/vendor/:stripeAccountId",
      stripeConnectValidators.updateVendor,
      superAdminController.updateVendor,
    );
  }
}
