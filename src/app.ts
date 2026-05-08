import express, { Application } from "express";
import compression from "compression";
import cors from "cors";
import status from "http-status";
import { api } from "@/modules/api";
import { ErrorResponse } from "@/helpers/api-response";
import { globalErrorHandler } from "@/middleware/error-handler";
import { WebhookRouter } from "@/webhooks";
import rateLimiter from "@/middleware/rate-limiter";
import helmet from "helmet";
import { corsOptions } from "@/config/cors";
import apiConfig from "@/config/api";
import cookieParser from "cookie-parser";
import { requestClientPlatform } from "@/middleware/client-platform";

export const createApp = (): Application => {
  try {
    const app = express();

    /**
     * ---------------------------------
     *            Middlewares
     * ---------------------------------
     */

    app.set("trust proxy", 1); // trust first proxy for rate limiting
    app.use(helmet());

    app.use(cors(corsOptions));

    app.use(
      express.urlencoded({
        extended: true,
        limit: apiConfig.API_MAX_URL_ENCODED_SIZE,
      }),
    );

    app.use(rateLimiter);
    app.use(requestClientPlatform);

    app.use("/webhook", new WebhookRouter().router);

    app.use(cookieParser());

    app.use(express.json({ limit: apiConfig.API_MAX_PAYLOAD_SIZE })); // Parsers for POST data

    app.use(compression()); // for gzipping the request

    app.use("/api", api); // route prefix

    // Error handling routes
    app.all("*", (req, res) => {
      return ErrorResponse(res, status.NOT_FOUND, {
        message: "Route Not Found",
      });
    });

    app.use(globalErrorHandler); // Global Error handler for logging requests

    return app;
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};
