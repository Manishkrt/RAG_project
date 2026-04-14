import mongoose, { Schema, Document as MDoc } from "mongoose";

export interface IChunk extends MDoc {
  userId: mongoose.Types.ObjectId;
  documentId: mongoose.Types.ObjectId;
  text: string;
  embedding: number[];
  page?: number;
}

const ChunkSchema = new Schema<IChunk>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    documentId: { type: Schema.Types.ObjectId, ref: "Document", index: true },
    text: { type: String, required: true },
    embedding: { type: [Number], default: [] },
    page: Number,
  },
  { timestamps: true }
);

export const ChunkModel = mongoose.model<IChunk>("Chunk", ChunkSchema);
