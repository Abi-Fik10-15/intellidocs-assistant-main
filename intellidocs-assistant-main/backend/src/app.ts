import express from "express";
import cors from "cors";
import helmet from "helmet";
import { routes } from "./routes/index.js";
import { errorMiddleware, requestLogger } from "./middleware/index.js";
import { isProduction } from "./config/index.js";

export function createApp(): express.Application {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: isProduction ? process.env.CORS_ORIGIN?.split(",") : true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  app.use(routes);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { message: "Route not found", code: "NOT_FOUND" },
    });
  });

  app.use(errorMiddleware);

  return app;
}
