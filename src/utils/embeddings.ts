export async function generateEmbedding(
  ai: any,
  text: string,
  model: string = '@cf/baai/bge-base-en-v1.5',
  gatewayId?: string
) {
  const result = await generateBatchEmbeddings(ai, [text], model, gatewayId);
  return result[0];
}

export async function generateBatchEmbeddings(
  ai: any,
  texts: string[],
  model: string = '@cf/baai/bge-base-en-v1.5',
  gatewayId?: string
) {
  const options: any = {};
  if (gatewayId) {
    options.gateway = {
      id: gatewayId,
      skipCache: false,
      cacheTtl: 3600
    };
  }

  const result = await ai.run(
    model,
    {
      text: texts
    },
    options
  );
  return result.data;
}

