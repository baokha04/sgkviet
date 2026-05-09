/**
 * AI Provider module.
 * Re-exports all types and provides the factory function.
 */

export {
  AiProvider,
  AiCapability,
  ChatRequest,
  ChatResponse,
  VisionRequest
} from './types';
export { GatewayAiProvider } from './gateway_provider';
export { CloudflareAiProvider } from './cloudflare_provider';
export { AiProviderChain } from './provider_chain';

import { Env } from '../types';
import { AiProvider } from './types';
import { GatewayAiProvider } from './gateway_provider';
import { CloudflareAiProvider } from './cloudflare_provider';
import { AiProviderChain } from './provider_chain';

/**
 * Create the AI provider chain from environment bindings.
 * Order: Cloudflare AI Gateway (primary) → Cloudflare Workers AI (fallback).
 */
export function createAiChain(
  env: Env,
  options?: {
    googleModel?: string;
    cfModel?: string;
  }
): AiProviderChain {
  const providers: AiProvider[] = [];

  // Primary: Gateway AI via Secrets Store
  if (env.GOOGLE_AI_KEY) {
    providers.push(
      new GatewayAiProvider(
        env.GOOGLE_AI_KEY,
        env.CF_AIG_TOKEN,
        options?.googleModel || 'google-ai-studio/gemini-2.5-flash'
      )
    );
  }

  // Fallback: Cloudflare Workers AI
  if (env.AI) {
    providers.push(
      new CloudflareAiProvider(
        env.AI,
        options?.cfModel || '@cf/meta/llama-3-8b-instruct'
      )
    );
  }

  if (providers.length === 0) {
    throw new Error(
      'No AI providers available. Check GOOGLE_AI_KEY and AI bindings.'
    );
  }

  return new AiProviderChain(providers);
}

