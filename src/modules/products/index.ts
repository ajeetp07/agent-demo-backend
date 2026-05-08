import { Middleware } from "@/middleware/auth";
import { ProductController } from "@/modules/products/product.controller";
import { ProductsAdminController } from "@/modules/products/product-admin.controller";
import { ProductSuperAdminController } from "@/modules/products/product-super-admin.controller";
import { productValidators } from "@/modules/products/utils/product.validation";
import { Router } from "express";

const middleware = new Middleware();

export class ProductsRouter {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.use(middleware.authMiddleware);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    const controller = new ProductController();

    this.router.get("/", productValidators.getProducts, controller.get);
    this.router.get(
      "/:id",
      productValidators.getProductById,
      controller.getOne,
    );
  }
}

export class AdminProductsRouter {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.use(middleware.adminMiddleware);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    const adminController = new ProductsAdminController();

    this.router.post(
      "/",
      productValidators.createProduct,
      adminController.create,
    );
    this.router.put(
      "/:id",
      productValidators.updateProduct,
      adminController.update,
    );
    this.router.delete(
      "/:id",
      productValidators.deleteProduct,
      adminController.delete,
    );
  }
}

export class SuperAdminProductsRouter {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.use(middleware.superAdminMiddleware);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    const superAdminController = new ProductSuperAdminController();

    this.router
      .get("/", productValidators.getProducts, superAdminController.get)
      .post("/", productValidators.createProduct, superAdminController.create);
    this.router
      .get(
        "/:id",
        productValidators.getProductById,
        superAdminController.getOne,
      )
      .put("/:id", productValidators.updateProduct, superAdminController.update)
      .delete(
        "/:id",
        productValidators.deleteProduct,
        superAdminController.delete,
      );
  }
}
