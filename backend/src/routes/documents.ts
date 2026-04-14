import { Router } from "express";
import multer from "multer";
import { auth, AuthedRequest } from "../middleware/auth.js";
import { DocumentModel } from "../models/Document.js";
import { ChunkModel } from "../models/Chunk.js";
import { enqueueForProcessing } from "../services/pipeline.js";
import { config } from "../lib/config.js";
import { cloudinary } from "../lib/cloudinary.js";

const upload = multer({ storage: multer.memoryStorage() });

export const docRouter = Router();

docRouter.post("/upload", auth, upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file || !req.userId) return res.status(400).json({ message: "file missing" });

  const uploaded = await uploadToCloudinary(req.file.buffer, req.file.originalname);

  const doc = await DocumentModel.create({
    userId: req.userId,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    storagePath: uploaded.secure_url,
    storagePublicId: uploaded.public_id,
    storageProvider: "cloudinary",
    deletedAt: null,
    status: "pending",
  });
  enqueueForProcessing(doc, req.file.buffer);
  res.json({ id: doc.id, status: doc.status });
});

docRouter.get("/", auth, async (req: AuthedRequest, res) => {
  const docs = await DocumentModel.find({ userId: req.userId, deletedAt: null }).sort({ createdAt: -1 });
  res.json(docs);
});

docRouter.delete("/:id", auth, async (req: AuthedRequest, res) => {
  const doc = await DocumentModel.findOne({ _id: req.params.id, userId: req.userId, deletedAt: null });
  if (!doc) return res.status(404).json({ message: "Not found" });

  // Soft-delete first so user can undo; chunks are removed from retrieval immediately.
  await ChunkModel.deleteMany({ documentId: doc._id });
  await DocumentModel.updateOne(
    { _id: doc._id },
    { deletedAt: new Date(), status: "pending", error: "" }
  );
  res.json({ ok: true, deleted: doc._id, originalName: doc.originalName });
});

docRouter.post("/:id/undo", auth, async (req: AuthedRequest, res) => {
  const doc = await DocumentModel.findOne({ _id: req.params.id, userId: req.userId, deletedAt: { $ne: null } });
  if (!doc) return res.status(404).json({ message: "Not found or not restorable" });

  doc.deletedAt = null;
  doc.status = "pending";
  doc.error = "";
  await doc.save();
  enqueueForProcessing(doc);
  res.json({ ok: true, restored: doc._id });
});

docRouter.delete("/:id/purge", auth, async (req: AuthedRequest, res) => {
  const doc = await DocumentModel.findOne({ _id: req.params.id, userId: req.userId });
  if (!doc) return res.status(404).json({ message: "Not found" });

  if (doc.storagePublicId) {
    await cloudinary.uploader.destroy(doc.storagePublicId, { resource_type: "raw" });
  }
  await ChunkModel.deleteMany({ documentId: doc._id });
  await doc.deleteOne();
  res.json({ ok: true, purged: doc._id });
});

function uploadToCloudinary(fileBuffer: Buffer, originalName: string): Promise<{ secure_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: config.cloudinaryFolder,
        resource_type: "raw",
        type: "upload",
        use_filename: true,
        unique_filename: true,
        filename_override: originalName,
      },
      (error, result) => {
        if (error || !result) return reject(error || new Error("Cloudinary upload failed"));
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(fileBuffer);
  });
}
