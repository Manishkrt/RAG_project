import path from "path";
import pdfParse from "pdf-parse";
import { DocumentModel, IDocument } from "../models/Document.js";
import { ChunkModel } from "../models/Chunk.js";
import { logger } from "../lib/logger.js";
import { pipeline } from "@xenova/transformers";

function chunkText(text: string, size = 500) {
  const tokens = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < tokens.length; i += size) {
    const chunk = tokens.slice(i, i + size).join(" ").trim();
    if (chunk.length > 20) chunks.push(chunk);
  }
  return chunks;
}

let extractor: any;

async function getExtractor() {
  if (!extractor) {
    extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }
  return extractor;
}

async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor();

  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });

  return Array.from(output.data);
}

async function embedSafe(text: string): Promise<number[]> {
  try {
    return await embed(text);
  } catch (err) {
    logger.warn({ err }, "embed failed, falling back to stub");
    const hash = Array.from(text.slice(0, 256)).map((c) => (c.charCodeAt(0) % 17) / 17);
    return hash;
  }
}

function sanitize(text: string) {
  return text
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractText(filePath: string, mimeType?: string, fileBuffer?: Buffer): Promise<string> {
  const sourceBuffer = fileBuffer ?? (await readFileBuffer(filePath));
  const ext = path.extname(filePath).toLowerCase();
  if (mimeType?.includes("pdf") || ext === ".pdf") {
    const data = await pdfParse(sourceBuffer);
    const clean = sanitize(data.text);
    if (clean.length < 80) return ""; // likely scanned or empty
    return clean;
  }
  // Fallback: assume UTF-8 text-like file
  const clean = sanitize(sourceBuffer.toString("utf8"));
  return clean.length < 40 ? "" : clean;
}

async function readFileBuffer(filePath: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(filePath)) {
    const res = await fetch(filePath);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Failed to download remote file: ${res.status}. Check Cloudinary delivery access/type settings.`);
      }
      throw new Error(`Failed to download remote file: ${res.status}`);
    }
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  }
  const fs = await import("fs");
  return fs.readFileSync(filePath);
}

export async function enqueueForProcessing(doc: IDocument, sourceBuffer?: Buffer) {
  process.nextTick(async () => {
    try {
      await DocumentModel.updateOne({ _id: doc.id }, { status: "processing" });
      const raw = await extractText(doc.storagePath, doc.mimeType, sourceBuffer);
      if (!raw) throw new Error("Empty or unsupported content (no extractable text)");
      const parts = chunkText(raw);
      if (!parts.length) throw new Error("No usable text chunks found");
      const embeddings = await Promise.all(parts.map(embedSafe));
      const chunkDocs = parts.map((text, idx) => ({
        userId: doc.userId,
        documentId: doc._id,
        text,
        embedding: embeddings[idx],
        page: idx + 1,
      }));
      await ChunkModel.insertMany(chunkDocs);
      await DocumentModel.updateOne({ _id: doc.id }, { status: "ready" });
    } catch (err) {
      logger.error({ err }, "Processing failed");
      await DocumentModel.updateOne({ _id: doc.id }, { status: "failed", error: `${err}` });
    }
  });
}
