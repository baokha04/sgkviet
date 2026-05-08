import { Env } from '../types';
import { decrypt } from '../utils/crypto';
import { processImagesWithOpenRouter } from '../utils/ocr';
import { reviewVietnameseMarkdown } from '../utils/vietnamese';
import { generateEmbedding, generateBatchEmbeddings } from '../utils/embeddings';
import { VectorService } from './vector_service';
import { OcrProcess, Config, BookPage } from '../db/types';

export class OcrProcessesService {
  constructor(private env: Env) {}

  async findAll() {
    const { results } = await this.env.DB.prepare(
      'SELECT * FROM ocr_process WHERE deleted = 0'
    ).all<OcrProcess>();
    return results;
  }

  private async getAiConfig() {
    const { results: configs } = await this.env.DB.prepare(
      "SELECT * FROM config WHERE key IN ('OPENROUTER_API_KEY', 'AI_MODEL', 'CF_AI_MODEL') AND active = 1 AND deleted = 0"
    ).all<Config>();

    let apiKey = '';
    let model = '';
    let cfModel = '@cf/google/gemma-4-26b-a4b-it';

    for (const config of configs) {
      if (config.key === 'OPENROUTER_API_KEY' && config.value) {
        apiKey = decrypt(
          config.value,
          this.env.ENCRYPTION_KEY || 'default-secret-key-12345678'
        );
      } else if (config.key === 'AI_MODEL' && config.value) {
        model = decrypt(
          config.value,
          this.env.ENCRYPTION_KEY || 'default-secret-key-12345678'
        );
      } else if (config.key === 'CF_AI_MODEL' && config.value) {
        cfModel = decrypt(
          config.value,
          this.env.ENCRYPTION_KEY || 'default-secret-key-12345678'
        );
      }
    }

    return { apiKey, model, cfModel };
  }

  async create(data: {
    book_page_id: number;
    markdown?: string | null;
    status: string;
    review?: string | null;
  }) {
    let review = data.review;
    if (!review && data.markdown) {
      const config = await this.getAiConfig();
      review = await reviewVietnameseMarkdown(
        data.markdown,
        this.env.AI,
        config.cfModel
      );
    }
    const result = await this.env.DB.prepare(
      'INSERT INTO ocr_process (book_page_id, markdown, status, review) VALUES (?, ?, ?, ?) RETURNING *'
    )
      .bind(data.book_page_id, data.markdown || null, data.status, review)
      .first<OcrProcess>();

    if (!result) {
      throw new Error('Failed to create OCR process');
    }

    // Index in Vectorize
    if (result.status === 'success' && result.markdown) {
      try {
        const vectorService = new VectorService(this.env.VECTOR_INDEX);
        const embedding = await generateEmbedding(this.env.AI, result.markdown);
        await vectorService.upsert(result.id.toString(), embedding, {
          book_page_id: result.book_page_id,
          markdown: result.markdown
        });
      } catch (error) {
        console.error('Failed to index in Vectorize:', error);
      }
    }

    return result;
  }

  async update(
    id: string,
    data: {
      book_page_id: number;
      markdown?: string | null;
      status: string;
      review?: string | null;
    }
  ) {
    let review = data.review;
    if (!review && data.markdown) {
      const config = await this.getAiConfig();
      review = await reviewVietnameseMarkdown(
        data.markdown,
        this.env.AI,
        config.cfModel
      );
    }
    const result = await this.env.DB.prepare(
      'UPDATE ocr_process SET book_page_id = ?, markdown = ?, status = ?, review = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted = 0 RETURNING *'
    )
      .bind(data.book_page_id, data.markdown || null, data.status, review, id)
      .first<OcrProcess>();

    if (result && result.status === 'success' && result.markdown) {
      try {
        const vectorService = new VectorService(this.env.VECTOR_INDEX);
        const embedding = await generateEmbedding(this.env.AI, result.markdown);
        await vectorService.upsert(result.id.toString(), embedding, {
          book_page_id: result.book_page_id,
          markdown: result.markdown
        });
      } catch (error) {
        console.error('Failed to index in Vectorize:', error);
      }
    }

    return result;
  }

  async softDelete(id: string) {
    await this.env.DB.prepare(
      'UPDATE ocr_process SET deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(id)
      .run();

    // Remove from Vectorize
    try {
      const vectorService = new VectorService(this.env.VECTOR_INDEX);
      await vectorService.delete([id]);
    } catch (error) {
      console.error('Failed to delete from Vectorize:', error);
    }
  }

  async upsertByBookPageId(data: {
    book_page_id: number;
    markdown?: string | null;
    status: string;
    review?: string | null;
  }) {
    const existing = await this.env.DB.prepare(
      'SELECT id FROM ocr_process WHERE book_page_id = ? AND deleted = 0'
    )
      .bind(data.book_page_id)
      .first<{ id: number }>();

    if (existing) {
      return await this.update(existing.id.toString(), data);
    } else {
      return await this.create(data);
    }
  }

  async reviewRange(fromId: number, toId?: number | null) {
    let query =
      'SELECT * FROM ocr_process WHERE book_page_id >= ? AND deleted = 0';
    const params: any[] = [fromId];

    if (toId) {
      query += ' AND book_page_id <= ?';
      params.push(toId);
    } else {
      query += ' AND book_page_id = ?';
      params[0] = fromId;
      query =
        'SELECT * FROM ocr_process WHERE book_page_id = ? AND deleted = 0';
    }

    const { results } = await this.env.DB.prepare(query)
      .bind(...params)
      .all<OcrProcess>();
    const config = await this.getAiConfig();

    let updatedCount = 0;
    for (const row of results) {
      if (row.markdown) {
        const review = await reviewVietnameseMarkdown(
          row.markdown,
          this.env.AI,
          config.cfModel
        );
        await this.env.DB.prepare(
          'UPDATE ocr_process SET review = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        )
          .bind(review, row.id)
          .run();
        updatedCount++;
      }
    }

    return { total: results.length, updated: updatedCount };
  }

  async processBatch() {
    const { apiKey, model, cfModel } = await this.getAiConfig();

    if (!apiKey || !model) {
      throw new Error('Missing OPENROUTER_API_KEY or AI_MODEL config');
    }

    // 2. Query pending pages
    const { results: pendingPages } = await this.env.DB.prepare(
      'SELECT id, image_url FROM book_page WHERE ocr_process_id IS NULL AND image_url IS NOT NULL AND deleted = 0 LIMIT 5'
    ).all<BookPage>();

    if (pendingPages.length === 0) {
      return { processed_pages: 0, success_count: 0, failure_count: 0 };
    }

    // 3. Process
    const pagesPayload = pendingPages.map((p: any) => ({
      id: p.id,
      imageUrl: p.image_url
    }));

    const results = await processImagesWithOpenRouter(
      pagesPayload,
      apiKey,
      model
    );

    let successCount = 0;
    let failureCount = 0;

    for (const result of results) {
      if (result.status === 'success') {
        const review = result.markdown
          ? await reviewVietnameseMarkdown(
              result.markdown,
              this.env.AI,
              cfModel
            )
          : null;
        const ocrProcess = await this.env.DB.prepare(
          'INSERT INTO ocr_process (book_page_id, markdown, status, review) VALUES (?, ?, ?, ?) RETURNING id'
        )
          .bind(result.id, result.markdown, 'success', review)
          .first<OcrProcess>();

        if (ocrProcess) {
          await this.env.DB.prepare(
            'UPDATE book_page SET ocr_process_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
          )
            .bind(ocrProcess.id, result.id)
            .run();
          successCount++;
        }
      } else {
        await this.env.DB.prepare(
          'INSERT INTO ocr_fail (book_page_id, reason) VALUES (?, ?)'
        )
          .bind(result.id, result.error || 'Unknown error')
          .run();
        failureCount++;
      }
    }

    return {
      processed_pages: pendingPages.length,
      success_count: successCount,
      failure_count: failureCount
    };
  }

  async reindexAll() {
    const { results } = await this.env.DB.prepare(
      'SELECT id, book_page_id, markdown FROM ocr_process WHERE status = "success" AND markdown IS NOT NULL AND deleted = 0'
    ).all<OcrProcess>();

    const vectorService = new VectorService(this.env.VECTOR_INDEX);
    let indexedCount = 0;
    const batchSize = 50;

    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      const texts = batch.map(r => r.markdown || '');
      
      try {
        const embeddings = await generateBatchEmbeddings(this.env.AI, texts);
        
        const vectors = batch.map((row, index) => {
          const markdown = row.markdown || '';
          return {
            id: row.id.toString(),
            values: embeddings[index],
            metadata: {
              book_page_id: row.book_page_id,
              markdown: markdown.length > 8000 ? markdown.substring(0, 8000) + '...' : markdown
            }
          };
        });

        await this.env.VECTOR_INDEX.upsert(vectors);
        indexedCount += batch.length;
      } catch (error) {
        console.error(`Failed to index batch starting at ${i}:`, error);
      }
    }

    return { total: results.length, indexed: indexedCount };
  }
}

