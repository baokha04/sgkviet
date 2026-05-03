import { Env } from '../types';

export class OcrFailsService {
  constructor(private env: Env) {}

  async findAll() {
    const { results } = await this.env.DB.prepare(
      'SELECT * FROM ocr_fail WHERE deleted = 0'
    ).all<any>();
    return results;
  }

  async create(data: { book_page_id?: number | null; reason?: string | null; }) {
    const result = await this.env.DB.prepare(
      'INSERT INTO ocr_fail (book_page_id, reason) VALUES (?, ?) RETURNING *'
    )
      .bind(data.book_page_id || null, data.reason || null)
      .first();

    if (!result) {
      throw new Error('Failed to create OCR fail record');
    }

    return result;
  }

  async softDelete(id: string) {
    await this.env.DB.prepare(
      'UPDATE ocr_fail SET deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(id)
      .run();
  }
}
