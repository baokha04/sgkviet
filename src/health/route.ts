import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { Env } from '../types';
import { GatewayAiProvider, CloudflareAiProvider } from '../ai';

const healthRoute = new OpenAPIHono<{ Bindings: Env }>();

const ProviderStatusSchema = z.object({
  provider: z.string(),
  model: z.string(),
  status: z.enum(['ok', 'error']),
  latency_ms: z.number(),
  message: z.string().optional(),
  error: z.string().optional()
});

const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(),
  providers: z.array(ProviderStatusSchema),
  bindings: z.object({
    ai: z.boolean(),
    db: z.boolean(),
    vectorize: z.boolean(),
    google_ai_key: z.boolean()
  })
});

/** Race a promise against a timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    )
  ]);
}

/** Probe a single provider and return its status. */
async function probeProvider(
  name: string,
  model: string,
  fn: () => Promise<string>,
  timeoutMs = 15000
): Promise<z.infer<typeof ProviderStatusSchema>> {
  const start = Date.now();
  try {
    const result = await withTimeout(fn(), timeoutMs);
    return {
      provider: name,
      model,
      status: 'ok',
      latency_ms: Date.now() - start,
      message: result.slice(0, 100)
    };
  } catch (error: any) {
    return {
      provider: name,
      model,
      status: 'error',
      latency_ms: Date.now() - start,
      error: error.message?.slice(0, 300)
    };
  }
}

healthRoute.openapi(
  createRoute({
    method: 'get',
    path: '/',
    responses: {
      200: {
        content: { 'application/json': { schema: HealthResponseSchema } },
        description: 'SGKViet API health check results'
      }
    }
  }),
  async (c: any) => {
    const env: Env = c.env;

    // Check bindings availability
    const bindings = {
      ai: !!env.AI,
      db: !!env.DB,
      vectorize: !!env.VECTOR_INDEX,
      google_ai_key: !!env.GOOGLE_AI_KEY
    };

    // Build probe tasks — run all in parallel
    const probes: Promise<z.infer<typeof ProviderStatusSchema>>[] = [];

    // Probe Gateway AI via provider
    if (env.GOOGLE_AI_KEY) {
      const googleModel = 'google-ai-studio/gemini-2.5-flash';
      probes.push(
        probeProvider('gateway', googleModel, async () => {
          const provider = new GatewayAiProvider(
            env.GOOGLE_AI_KEY,
            env.CF_AIG_TOKEN,
            googleModel
          );
          const response = await provider.chat({
            system: 'Respond with only the word: OK',
            prompt: ''
          });
          return response.text;
        })
      );
    }

    // Probe Cloudflare Workers AI via provider
    if (env.AI) {
      const workersModel = '@cf/meta/llama-3-8b-instruct';
      probes.push(
        probeProvider('cloudflare', workersModel, async () => {
          const provider = new CloudflareAiProvider(env.AI, workersModel, 0);
          const response = await provider.chat({
            system: 'Respond with only the word: OK',
            prompt: '',
            maxTokens: 10
          });
          return response.text;
        })
      );
    }

    const providers = await Promise.all(probes);

    // Derive overall status
    const okCount = providers.filter((p) => p.status === 'ok').length;
    const overallStatus =
      okCount === providers.length
        ? 'healthy'
        : okCount > 0
          ? 'degraded'
          : 'unhealthy';

    return c.json(
      {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        providers,
        bindings
      },
      200
    );
  }
);

export { healthRoute };

