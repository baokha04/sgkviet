import { VectorizeIndex } from '@cloudflare/workers-types';

export interface VectorMetadata {
  book_page_id: number;
  markdown: string;
}

export class VectorService {
  constructor(private index: VectorizeIndex) {}

  async upsert(id: string, values: number[], metadata: VectorMetadata) {
    // Truncate markdown to fit metadata limits (10240 bytes total)
    // We'll keep it under 8000 characters to be safe with other metadata and JSON overhead
    const truncatedMarkdown = metadata.markdown.length > 8000 
      ? metadata.markdown.substring(0, 8000) + '...'
      : metadata.markdown;

    await this.index.upsert([
      {
        id,
        values,
        metadata: {
          book_page_id: metadata.book_page_id,
          markdown: truncatedMarkdown
        }
      }
    ]);
  }

  async query(values: number[], topK: number = 5) {
    const results = await this.index.query(values, {
      topK,
      returnMetadata: 'all'
    });
    return results.matches.map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata as unknown as VectorMetadata
    }));
  }

  async delete(ids: string[]) {
    await this.index.deleteByIds(ids);
  }
}
