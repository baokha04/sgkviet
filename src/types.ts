export interface Env {
  DB: D1Database;
  AI: Ai;
  VECTOR_INDEX: VectorizeIndex;
  GOOGLE_AI_KEY: { get(): Promise<string> };
  CF_AIG_TOKEN: string;
}
