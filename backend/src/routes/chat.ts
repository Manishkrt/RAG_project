import { Router } from "express";
import { auth, AuthedRequest } from "../middleware/auth.js";
import { ChatMessageModel } from "../models/ChatMessage.js";
import { retrieveAndAnswer } from "../services/retrieval.js";

export const chatRouter = Router();

chatRouter.get("/history", auth, async (req: AuthedRequest, res) => {
  const history = await ChatMessageModel.find({ userId: req.userId }).sort({ createdAt: 1 }).limit(100);
  res.json(history);
});

chatRouter.post("/ask", auth, async (req: AuthedRequest, res) => {
  const { question, documentIds } = req.body as { question?: string; documentIds?: string[] };
  if (!question) return res.status(400).json({ message: "Question required" });
  const answer = await retrieveAndAnswer({ userId: req.userId!, question, documentIds });
  await ChatMessageModel.insertMany([
    { userId: req.userId, role: "user", content: question },
    { userId: req.userId, role: "assistant", content: answer.text, citations: answer.citations },
  ]);
  res.json(answer);
});

chatRouter.delete("/reset", auth, async (req: AuthedRequest, res) => {
  await ChatMessageModel.deleteMany({ userId: req.userId });
  res.json({ ok: true });
});
