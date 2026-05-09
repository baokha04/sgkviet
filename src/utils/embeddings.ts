import { Env } from '../types';
import { ConfigsService } from '../configs/service';

export async function generateEmbedding(
  env: Env,
  text: string,
  model?: string,
  gatewayId?: string
) {
  const result = await generateBatchEmbeddings(env, [text], model, gatewayId);
  return result[0];
}

export async function generateBatchEmbeddings(
  env: Env,
  texts: string[],
  model?: string,
  gatewayId?: string
) {
  let modelToUse = model;
  if (!modelToUse) {
    const configsService = new ConfigsService(env);
    const config = await configsService.findByKey('EMBEDDING_MODEL');
    modelToUse = config?.value || '@cf/baai/bge-base-en-v1.5';
  }

  const options: any = {};
  if (gatewayId) {
    options.gateway = {
      id: gatewayId,
      skipCache: false,
      cacheTtl: 3600
    };
  }

  const result = await env.AI.run(
    modelToUse as '@cf/baai/bge-base-en-v1.5',
    {
      text: texts
    },
    options
  );
  return (result as any).data;
}

