import { ChunkModel } from "../models/Chunk.js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { generateAnswer } from "./llm.js";
import { pipeline } from "@xenova/transformers";
import mongoose from "mongoose";

interface RetrieveInput {
  userId: string;
  question: string;
  documentIds?: string[];
}

// ✅ Proper Mongo type
type ChunkType = {
  text: string;
  embedding: number[];
  documentId: mongoose.Types.ObjectId;
  _id: mongoose.Types.ObjectId;
};

export async function retrieveAndAnswer(input: RetrieveInput) {
  const { userId, question, documentIds } = input;

  try {
    const queryEmbedding = await embedQuery(question);

    const baseFilter: any = { userId };
    if (documentIds?.length) {
      baseFilter.documentId = {
        $in: documentIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    let hits: ChunkType[] = [];

    // 🔥 vector search
    if (queryEmbedding) {
      const candidates = await ChunkModel.find(baseFilter).limit(200);

      const scored = (candidates as any[])
        .map((c) => ({
          chunk: c as ChunkType,
          score: cosine(queryEmbedding, c.embedding || []),
        }))
        .filter((s) => Number.isFinite(s.score));

      scored.sort((a, b) => b.score - a.score);

      hits = scored
        .filter((s) => s.score >= 0.2)
        .slice(0, 8)
        .map((s) => s.chunk);
    }

    // 🔁 fallback
    if (hits.length === 0) {
      logger.warn("No vector hits, using fallback");
      hits = (await ChunkModel.find(baseFilter).limit(5)) as any[];
    }

    if (hits.length === 0) {
      return {
        text: "I don't have enough information in your documents.",
        citations: [],
      };
    }

    // ✅ clean context
    const context = hits
      .map((h) => cleanSnippet(h.text, 500))
      .join("\n\n");

    const llmAnswer = await generateAnswer(question, context);

    const answerText = llmAnswer || "LLM failed to generate answer";

    return {
      text: answerText,
      citations: hits.map((h) => ({
        documentId: h.documentId.toString(), // ✅ FIX
        chunkId: h._id.toString(),           // ✅ FIX
      })),
    };
  } catch (err) {
    logger.error({ err }, "Retrieval failed");

    return {
      text: "Something went wrong.",
      citations: [],
    };
  }
}

// ================= CLEAN =================

function cleanSnippet(text: string, maxLen: number) {
  return text
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

// ================= EMBEDDING =================

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

async function embedQuery(text: string): Promise<number[]> {
  const extractor = await getExtractor();

  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });

  return Array.from(output.data);
}

// ================= COSINE =================

function cosine(a: number[], b: number[]) {
  const len = Math.min(a.length, b.length);
  if (!len) return 0;

  let dot = 0,
    na = 0,
    nb = 0;

  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }

  if (na === 0 || nb === 0) return 0;

  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}