import fs from "fs";
import path from "path";

export interface PageSizeOption {
  id: string;
  name: string;
  description: string;
  widthMm: number;
  heightMm: number;
}

export interface SystemConfig {
  AUTHOR_NAME: string;
  TARGET_AUDIENCE: string;
  TONE_OF_VOICE: string;
  MIN_PAGES: number;
  MAX_PAGES: number;
  VECTOR_DB_PROVIDER: string;
  LLM_MODEL: string;
  DESIGN_TYPOGRAPHY: string;
  DESIGN_SPACING: number;
  DEFAULT_PAGE_SIZE?: string;
  AVAILABLE_PAGE_SIZES?: PageSizeOption[];
  AVAILABLE_TYPOGRAPHIES?: string[];
}

let cachedConfig: SystemConfig | null = null;

export function getSystemConfig(): SystemConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.join(process.cwd(), "config", "system.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`Arquivo de configuração não encontrado em: ${configPath}`);
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  cachedConfig = JSON.parse(raw) as SystemConfig;
  return cachedConfig;
}

export function getEnvConfig() {
  let rawKey = process.env.GEMINI_API_KEY || "";
  
  if (!rawKey) {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, "utf-8");
        const match = content.match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
        if (match) {
          rawKey = match[1].trim();
        }
      } catch {}
    }
  }

  const sanitizedKey = rawKey.trim().replace(/^["']|["']$/g, "");

  return {
    GEMINI_API_KEY: sanitizedKey,
    VECTOR_DB_PROVIDER: process.env.VECTOR_DB_PROVIDER || "ChromaDB",
    CHROMA_SERVER_URL: process.env.CHROMA_SERVER_URL || "http://localhost:8000",
    DATABASE_PATH: process.env.DATABASE_PATH || "./data/ebook_generator.db",
    PORT: process.env.PORT || "3000",
    NODE_ENV: process.env.NODE_ENV || "development",
  };
}
