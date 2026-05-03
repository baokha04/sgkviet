import { Env } from '../types';

export class BooksService {
  constructor(private env: Env) {}

  async findAll() {
    const { results } = await this.env.DB.prepare(
      'SELECT * FROM book WHERE deleted = 0'
    ).all<any>();
    return results;
  }

  async create(data: { title: string; unsigned_title?: string | null; description?: string | null; url?: string | null; }) {
    const result = await this.env.DB.prepare(
      'INSERT INTO book (title, unsigned_title, description, url) VALUES (?, ?, ?, ?) RETURNING *'
    )
      .bind(
        data.title,
        data.unsigned_title || null,
        data.description || null,
        data.url || null
      )
      .first();

    if (!result) {
      throw new Error('Failed to create book');
    }

    return result;
  }

  async softDelete(id: string) {
    await this.env.DB.prepare(
      'UPDATE book SET deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(id)
      .run();
  }
}
