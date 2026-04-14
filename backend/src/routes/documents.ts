import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { auth, AuthedRequest } from "../middleware/auth.js";
import { DocumentModel } from "../models/Document.js";
import { ChunkModel } from "../models/Chunk.js";
import { enqueueForProcessing } from "../services/pipeline.js";
import { config } from "../lib/config.js";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), config.uploadDir);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    cb(null, `${uuid()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

export const docRouter = Router();

docRouter.post("/upload", auth, upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file || !req.userId) return res.status(400).json({ message: "file missing" });
  const doc = await DocumentModel.create({
    userId: req.userId,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    storagePath: req.file.path,
    status: "pending",
  });
  enqueueForProcessing(doc);
  res.json({ id: doc.id, status: doc.status });
});

docRouter.get("/", auth, async (req: AuthedRequest, res) => {
  const docs = await DocumentModel.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json(docs);
});

docRouter.delete("/:id", auth, async (req: AuthedRequest, res) => {
  const doc = await DocumentModel.findOne({ _id: req.params.id, userId: req.userId });
  if (!doc) return res.status(404).json({ message: "Not found" });
  // remove stored file if exists
  if (doc.storagePath && fs.existsSync(doc.storagePath)) {
    try {
      fs.unlinkSync(doc.storagePath);
    } catch (err) {
      // log and continue
      console.warn("Failed to delete file", err);
    }
  }
  await ChunkModel.deleteMany({ documentId: doc._id });
  await doc.deleteOne();
  res.json({ ok: true, deleted: doc._id });
});
