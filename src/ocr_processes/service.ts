import { Env } from '../types';
import { decrypt } from '../utils/crypto';
import { processImagesWithOpenRouter } from '../utils/ocr';
import { reviewVietnameseMarkdown } from '../utils/vietnamese';

export class OcrProcessesService {
  constructor(private env: Env) {}

  async findAll() {
    const { results } = await this.env.DB.prepare(
      'SELECT * FROM ocr_process WHERE deleted = 0'
    ).all<any>();
    return results;
  }

  async create(data: { book_page_id: number; markdown?: string | null; status: string; review?: string | null; }) {
    const review = data.review || (data.markdown ? reviewVietnameseMarkdown(data.markdown) : null);
    const result = await this.env.DB.prepare(
      'INSERT INTO ocr_process (book_page_id, markdown, status, review) VALUES (?, ?, ?, ?) RETURNING *'
    )
      .bind(data.book_page_id, data.markdown || null, data.status, review)
      .first();

    if (!result) {
      throw new Error('Failed to create OCR process');
    }

    return result;
  }

  async update(id: string, data: { book_page_id: number; markdown?: string | null; status: string; review?: string | null; }) {
    const review = data.review || (data.markdown ? reviewVietnameseMarkdown(data.markdown) : null);
    const result = await this.env.DB.prepare(
      'UPDATE ocr_process SET book_page_id = ?, markdown = ?, status = ?, review = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted = 0 RETURNING *'
    )
      .bind(data.book_page_id, data.markdown || null, data.status, review, id)
      .first();

    return result;
  }

  async softDelete(id: string) {
    await this.env.DB.prepare(
      'UPDATE ocr_process SET deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(id)
      .run();
  }

  async upsertByBookPageId(data: { book_page_id: number; markdown?: string | null; status: string; review?: string | null; }) {
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
    let query = 'SELECT * FROM ocr_process WHERE book_page_id >= ? AND deleted = 0';
    const params: any[] = [fromId];

    if (toId) {
      query += ' AND book_page_id <= ?';
      params.push(toId);
    } else {
      query += ' AND book_page_id = ?';
      // params.push(fromId); // Already added as the first param for >= but if toId is null, we want exact match for book_page_id
      // Actually, if toId is null, the requirement says "get 1 record from book_page_id", so book_page_id = fromId.
      params[0] = fromId;
      query = 'SELECT * FROM ocr_process WHERE book_page_id = ? AND deleted = 0';
    }

    const { results } = await this.env.DB.prepare(query).bind(...params).all<any>();

    let updatedCount = 0;
    for (const row of results) {
      if (row.markdown) {
        const review = reviewVietnameseMarkdown(row.markdown);
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
    // 1. Fetch config
    const { results: configs } = await this.env.DB.prepare(
      "SELECT * FROM config WHERE key IN ('OPENROUTER_API_KEY', 'AI_MODEL') AND active = 1 AND deleted = 0"
    ).all<any>();

    let apiKey = '';
    let model = '';

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
      }
    }

    if (!apiKey || !model) {
      throw new Error('Missing OPENROUTER_API_KEY or AI_MODEL config');
    }

    // 2. Query pending pages
    const { results: pendingPages } = await this.env.DB.prepare(
      'SELECT id, image_url FROM book_page WHERE ocr_process_id IS NULL AND image_url IS NOT NULL AND deleted = 0 LIMIT 5'
    ).all<any>();

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
        const review = result.markdown ? reviewVietnameseMarkdown(result.markdown) : null;
        const ocrProcess = await this.env.DB.prepare(
          'INSERT INTO ocr_process (book_page_id, markdown, status, review) VALUES (?, ?, ?, ?) RETURNING id'
        )
          .bind(result.id, result.markdown, 'success', review)
          .first<any>();

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
}
