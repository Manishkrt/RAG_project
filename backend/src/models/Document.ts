import mongoose, { Schema, Document as MDoc } from "mongoose";

export interface IDocument extends MDoc {
  userId: mongoose.Types.ObjectId;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  storagePublicId?: string;
  storageProvider?: "cloudinary";
  deletedAt?: Date | null;
  status: "pending" | "processing" | "ready" | "failed";
  error?: string;
}

const DocumentSchema = new Schema<IDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true, required: true },
    originalName: String,
    mimeType: String,
    size: Number,
    storagePath: String,
    storagePublicId: String,
    storageProvider: { type: String, default: "cloudinary" },
    deletedAt: { type: Date, default: null, index: true },
    status: { type: String, enum: ["pending", "processing", "ready", "failed"], default: "pending" },
    error: String,
  },
  { timestamps: true }
);

export const DocumentModel = mongoose.model<IDocument>("Document", DocumentSchema);
