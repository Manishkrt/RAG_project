import mongoose, { Schema, Document as MDoc } from "mongoose";

export interface IChatMessage extends MDoc {
  userId: mongoose.Types.ObjectId;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Array<{ documentId: string; chunkId?: string }>;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
    citations: [{ documentId: String, chunkId: String }],
  },
  { timestamps: true }
);

export const ChatMessageModel = mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);
