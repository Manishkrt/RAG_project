import express from "express";
import cors from "cors";
import helmet from "helmet";
import "express-async-errors";
import mongoose from "mongoose";
import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.js";
import { docRouter } from "./routes/documents.js";
import { chatRouter } from "./routes/chat.js";

const app = express();

app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);
app.use(helmet());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.use("/api/auth", authRouter);
app.use("/api/docs", docRouter);
app.use("/api/chat", chatRouter);

app.use(errorHandler);

async function bootstrap() {
  await mongoose.connect(config.mongoUrl);
  app.listen(config.port, () => {
    logger.info(`API ready on port ${config.port}`);
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
