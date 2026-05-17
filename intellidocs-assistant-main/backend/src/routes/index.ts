import { Router } from "express";
import { apiRouter } from "./api.routes.js";

export const routes = Router();

routes.use("/api", apiRouter);
