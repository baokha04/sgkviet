import { Env } from '../types';

export class BookPagesService {
  constructor(private env: Env) {}

  async findAll(book_id?: number, from_page?: number, to_page?: number) {
    let query = 'SELECT * FROM book_page WHERE deleted = 0';
    const params: any[] = [];
    
    if (book_id !== undefined) {
      query += ' AND book_id = ?';
      params.push(book_id);
    }
    if (from_page !== undefined) {
      query += ' AND page_number >= ?';
      params.push(from_page);
    }
    if (to_page !== undefined) {
      query += ' AND page_number <= ?';
      params.push(to_page);
    }

    query += ' ORDER BY page_number ASC';

    const { results } = await this.env.DB.prepare(query)
      .bind(...params)
      .all<any>();
    return results;
  }

  async create(data: { book_id: number; page_number: number; image_url?: string | null; ocr_process_id?: number | null; }) {
    const result = await this.env.DB.prepare(
      'INSERT INTO book_page (book_id, page_number, image_url, ocr_process_id) VALUES (?, ?, ?, ?) RETURNING *'
    )
      .bind(
        data.book_id,
        data.page_number,
        data.image_url || null,
        data.ocr_process_id || null
      )
      .first();

    if (!result) {
      throw new Error('Failed to create book page');
    }

    return result;
  }

  async softDelete(id: string) {
    await this.env.DB.prepare(
      'UPDATE book_page SET deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(id)
      .run();
  }

  async findIdByBookAndPage(bookId: number, pageNumber: number) {
    const result = await this.env.DB.prepare(
      'SELECT id FROM book_page WHERE book_id = ? AND page_number = ? AND deleted = 0'
    )
      .bind(bookId, pageNumber)
      .first<{ id: number }>();
    return result;
  }

  async updateOcrProcessId(id: string, ocrProcessId: number) {
    const result = await this.env.DB.prepare(
      'UPDATE book_page SET ocr_process_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted = 0 RETURNING *'
    )
      .bind(ocrProcessId, id)
      .first();
    return result;
  }
}
