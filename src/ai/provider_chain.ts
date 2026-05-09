import { AiProvider, ChatRequest, ChatResponse, VisionRequest } from './types';

/**
 * Provider chain with automatic fallback.
 * Tries providers in order; on error, falls back to the next one.
 */
export class AiProviderChain {
  constructor(private providers: AiProvider[]) {
    if (providers.length === 0) {
      throw new Error('AiProviderChain requires at least one provider');
    }
  }

  /** Run a chat request through the provider chain. */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const errors: string[] = [];

    for (const provider of this.providers) {
      if (!provider.capabilities.includes('chat')) continue;
      try {
        const response = await provider.chat(request);
        if (errors.length > 0) {
          console.log(
            `[AiProviderChain] Succeeded with ${provider.name} after ${errors.length} fallback(s)`
          );
        }
        return response;
      } catch (error: any) {
        const msg = `${provider.name}: ${error.message || error}`;
        errors.push(msg);
        console.error(`[AiProviderChain] ${msg}`);
      }
    }

    throw new Error(
      `All AI providers failed for chat:\n${errors.join('\n')}`
    );
  }

  /** Run a vision request through the provider chain. */
  async vision(request: VisionRequest): Promise<ChatResponse> {
    const visionProviders = this.providers.filter(
      (p) => p.capabilities.includes('vision') && p.vision
    );

    if (visionProviders.length === 0) {
      throw new Error('No AI provider with vision capability available');
    }

    const errors: string[] = [];

    for (const provider of visionProviders) {
      try {
        const response = await provider.vision!(request);
        if (errors.length > 0) {
          console.log(
            `[AiProviderChain] Vision succeeded with ${provider.name} after ${errors.length} fallback(s)`
          );
        }
        return response;
      } catch (error: any) {
        const msg = `${provider.name}: ${error.message || error}`;
        errors.push(msg);
        console.error(`[AiProviderChain] Vision ${msg}`);
      }
    }

    throw new Error(
      `All AI providers failed for vision:\n${errors.join('\n')}`
    );
  }

  /** Get the list of provider names. */
  getProviderNames(): string[] {
    return this.providers.map((p) => p.name);
  }
}
