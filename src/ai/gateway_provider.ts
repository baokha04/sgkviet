import { OpenAI } from 'openai';
import {
  AiProvider,
  AiCapability,
  ChatRequest,
  ChatResponse,
  VisionRequest
} from './types';

/**
 * Cloudflare AI Gateway provider using OpenAI SDK.
 * Supports both chat and vision (OCR) capabilities via OpenAI compatibility endpoint.
 * API key is fetched from Cloudflare Secrets Store binding.
 *
 * Example cURL:
 * curl --location 'https://gateway.ai.cloudflare.com/v1/10967a4b8c62094c578cfacf8814237b/sgkviet-gateway/compat/chat/completions' \
 * --header 'cf-aig-authorization: Bearer {CF_AIG_TOKEN}' \
 * --header 'Content-Type: application/json' \
 * --header 'Authorization: Bearer {GOOGLE_AI_KEY}' \
 * --data '{
 *     "model": "google-ai-studio/gemini-2.5-flash",
 *     "messages": [
 *       {
 *         "role": "user",
 *         "content": "What is Cloudflare?"
 *       }
 *     ]
 *   }'
 */
export class GatewayAiProvider implements AiProvider {
  readonly name = 'gateway';
  readonly capabilities: AiCapability[] = ['chat', 'vision'];

  private ai: OpenAI | null = null;
  private apiKeyPromise: Promise<string> | null = null;

  constructor(
    private keyBinding: { get(): Promise<string> },
    private aigToken: string,
    private model: string = 'google-ai-studio/gemini-2.5-flash'
  ) {}

  private async getClient(): Promise<OpenAI> {
    if (!this.ai) {
      if (!this.apiKeyPromise) {
        this.apiKeyPromise = this.keyBinding.get();
      }
      const apiKey = await this.apiKeyPromise;
      this.ai = new OpenAI({
        apiKey: apiKey,
        baseURL:
          'https://gateway.ai.cloudflare.com/v1/10967a4b8c62094c578cfacf8814237b/sgkviet-gateway/compat',
        defaultHeaders: {
          'cf-aig-authorization': `Bearer ${this.aigToken}`
        }
      });
    }
    return this.ai;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const ai = await this.getClient();
    const start = Date.now();

    const response = await ai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.prompt }
      ],
      max_tokens: request.maxTokens
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error('Invalid response format from Gateway AI');
    }

    return {
      text,
      provider: this.name,
      model: this.model,
      latencyMs: Date.now() - start
    };
  }

  async vision(request: VisionRequest): Promise<ChatResponse> {
    const ai = await this.getClient();
    const start = Date.now();

    const response = await ai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: request.system },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${request.mimeType};base64,${request.imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: request.maxTokens
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error('Invalid response format from Gateway AI Vision');
    }

    return {
      text,
      provider: this.name,
      model: this.model,
      latencyMs: Date.now() - start
    };
  }
}

