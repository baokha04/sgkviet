/**
 * Unified AI provider abstraction.
 * All AI calls in the codebase go through this interface.
 */

export interface ChatRequest {
  system: string;
  prompt: string;
  maxTokens?: number;
}

export interface ChatResponse {
  text: string;
  provider: string;
  model: string;
  latencyMs: number;
}

export interface VisionRequest {
  system: string;
  imageBase64: string;
  mimeType: string;
  maxTokens?: number;
}

export type AiCapability = 'chat' | 'vision';

export interface AiProvider {
  readonly name: string;
  readonly capabilities: AiCapability[];
  chat(request: ChatRequest): Promise<ChatResponse>;
  vision?(request: VisionRequest): Promise<ChatResponse>;
}
