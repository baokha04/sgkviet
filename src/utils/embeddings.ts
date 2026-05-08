export async function generateEmbedding(ai: any, text: string, model: string = '@cf/baai/bge-base-en-v1.5') {
  const result = await generateBatchEmbeddings(ai, [text], model);
  return result[0];
}

export async function generateBatchEmbeddings(ai: any, texts: string[], model: string = '@cf/baai/bge-base-en-v1.5') {
  const result = await ai.run(model, {
    text: texts
  });
  return result.data;
}
