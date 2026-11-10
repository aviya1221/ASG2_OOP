/**
 * Settings of the Gemini adapter. Read from environment variables by
 * src/config/env.ts; the defaults below follow Google's model page
 * (https://aistudio.google.com/docs/models, checked 2026-11-06).
 */
export interface GeminiConfig {
  /** Key from Google AI Studio (https://aistudio.google.com/apikey). Server side only. */
  apiKey: string;
  /** Model for text and JSON answers. */
  textModel: string;
  /** Model for reviewing homework solutions: a class can need 150 reviews of one homework (ADR-9). */
  reviewModel: string;
  /** Model for embeddings (comparing homework). */
  embeddingModel: string;
  /** Length of each embedding vector; 768 is one of the sizes Google recommends. */
  embeddingDimensions: number;
  /**
   * Whether Google keeps each interaction (1 day on the free tier, 55 days on
   * paid). Off by default: we send student work and never continue a
   * conversation on Google's side.
   */
  storeInteractions: boolean;
  /** How long `uploadFile` waits for Google to finish processing a file (videos take a while). */
  fileReadyTimeoutMs: number;
  /** How often `uploadFile` checks whether the file is ready. */
  filePollIntervalMs: number;
}

export const GEMINI_DEFAULTS = {
  /** Current stable Flash model. gemini-2.5-* are deprecated and re-routed on 2026-12-01. */
  textModel: "gemini-3.6-flash",
  /** The light model, chosen in the homework review spike (docs/02-tools-report.md, ADR-9). */
  reviewModel: "gemini-3.5-flash-lite",
  /** Google's recommended embedding model (multimodal). */
  embeddingModel: "gemini-embedding-2",
  embeddingDimensions: 768,
  storeInteractions: false,
  fileReadyTimeoutMs: 5 * 60_000,
  filePollIntervalMs: 2_000,
} as const satisfies Omit<GeminiConfig, "apiKey">;
