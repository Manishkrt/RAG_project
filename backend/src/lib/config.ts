import dotenv from "dotenv";
dotenv.config();

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) throw new Error(`Missing env ${key}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: requireEnv("JWT_SECRET", "dev-secret"),
  mongoUrl: requireEnv("MONGO_URL", "mongodb://localhost:27017/doc-intel"),
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  llmProvider: process.env.LLM_PROVIDER || "groq",
  llmModel: process.env.LLM_MODEL || "llama-3.1-8b-instant",
  groqApiKey: requireEnv("GROQ_API_KEY"),
  cloudinaryCloudName: requireEnv("CLOUDINARY_CLOUD_NAME"),
  cloudinaryApiKey: requireEnv("CLOUDINARY_API_KEY"),
  cloudinaryApiSecret: requireEnv("CLOUDINARY_API_SECRET"),
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER || "doc-intel",
};
