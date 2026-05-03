import { Env } from '../types';
import { decrypt } from '../utils/crypto';
import { processImagesWithOpenRouter } from '../utils/ocr';

export class OcrProcessesService {
  constructor(private env: Env) {}

  async findAll() {
    const { results } = await this.env.DB.prepare(
      'SELECT * FROM ocr_process WHERE deleted = 0'
    ).all<any>();
    return results;
  }

  async create(data: { book_page_id: number; markdown?: string | null; status: string; }) {
    const result = await this.env.DB.prepare(
      'INSERT INTO ocr_process (book_page_id, markdown, status) VALUES (?, ?, ?) RETURNING *'
    )
      .bind(data.book_page_id, data.markdown || null, data.status)
      .first();

    if (!result) {
      throw new Error('Failed to create OCR process');
    }

    return result;
  }

  async update(id: string, data: { book_page_id: number; markdown?: string | null; status: string; }) {
    const result = await this.env.DB.prepare(
      'UPDATE ocr_process SET book_page_id = ?, markdown = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted = 0 RETURNING *'
    )
      .bind(data.book_page_id, data.markdown || null, data.status, id)
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
        const ocrProcess = await this.env.DB.prepare(
          'INSERT INTO ocr_process (book_page_id, markdown, status) VALUES (?, ?, ?) RETURNING id'
        )
          .bind(result.id, result.markdown, 'success')
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
