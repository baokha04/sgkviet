import { AiProvider, AiCapability, ChatRequest, ChatResponse } from './types';

/**
 * Cloudflare Workers AI provider.
 * Supports chat capability with built-in retry logic.
 */
export class CloudflareAiProvider implements AiProvider {
  readonly name = 'cloudflare';
  readonly capabilities: AiCapability[] = ['chat'];

  constructor(
    private ai: Ai,
    private model: string = '@cf/meta/llama-3-8b-instruct',
    private maxRetries: number = 3
  ) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const MAX_CONTENT_LENGTH = 30000;
    let prompt = request.prompt;
    if (prompt.length > MAX_CONTENT_LENGTH) {
      console.warn(`Content length (${prompt.length}) exceeds limit, truncating...`);
      prompt = prompt.substring(0, MAX_CONTENT_LENGTH) + '... [truncated]';
    }

    let lastError: any;
    const start = Date.now();

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const retryAfter = lastError?.retry_after
            ? lastError.retry_after * 1000
            : Math.pow(2, attempt) * 1000;
          console.log(
            `Waiting ${retryAfter}ms before retrying Cloudflare AI (attempt ${attempt + 1}/${this.maxRetries + 1})...`
          );
          await new Promise((resolve) => setTimeout(resolve, retryAfter));
        }

        const response = await this.ai.run(this.model as any, {
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: prompt }
          ],
          max_tokens: request.maxTokens
        });

        if (!response) {
          throw new Error('Empty response from Cloudflare AI');
        }

        const result = (response as any).response ?? response;
        const text = typeof result === 'string'
          ? result
          : result?.response ?? JSON.stringify(result);

        return {
          text,
          provider: this.name,
          model: this.model,
          latencyMs: Date.now() - start
        };
      } catch (error: any) {
        lastError = error;
        console.error(`Cloudflare AI attempt ${attempt + 1} failed:`, error.message || error);

        const isRetryable =
          error.message?.includes('502') ||
          error.message?.includes('503') ||
          error.message?.includes('504') ||
          error.message?.includes('overloaded') ||
          error.status === 502 ||
          error.status === 503 ||
          error.retryable === true ||
          error.error_code === 502;

        if (!isRetryable || attempt === this.maxRetries) {
          break;
        }
      }
    }

    throw new Error(
      `Cloudflare AI failed after ${this.maxRetries + 1} attempts. Last error: ${
        lastError?.message || lastError?.title || 'Unknown error'
      }`
    );
  }
}
