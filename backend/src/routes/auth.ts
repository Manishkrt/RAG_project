import { Router } from "express";
import jwt from "jsonwebtoken";
import { UserModel } from "../models/User.js";
import { config } from "../lib/config.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const { email, password } = req.body;
  const existing = await UserModel.findOne({ email });
  if (existing) return res.status(409).json({ message: "User exists" });
  const user = new UserModel({ email, password });
  await user.save();
  const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: "7d" });
  res.json({ token });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await UserModel.findOne({ email });
  if (!user) return res.status(401).json({ message: "Invalid credentials" });
  const ok = await user.comparePassword(password);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });
  const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: "7d" });
  res.json({ token });
});
