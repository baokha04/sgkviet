import { Env } from '../types';
import { encrypt, decrypt } from '../utils/crypto';

export class ConfigsService {
  constructor(private env: Env) {}

  async findAll() {
    const { results } = await this.env.DB.prepare(
      'SELECT * FROM config WHERE deleted = 0'
    ).all<any>();

    return results;
  }

  async findByKey(key: string) {
    const result = await this.env.DB.prepare(
      'SELECT * FROM config WHERE key = ? AND deleted = 0'
    )
      .bind(key)
      .first<any>();

    return result;
  }

  async create(data: { key: string; value?: string | null; active?: boolean }) {
    const encryptedValue = data.value
      ? encrypt(
          data.value,
          this.env.ENCRYPTION_KEY || 'default-secret-key-12345678'
        )
      : null;
    const result = await this.env.DB.prepare(
      'INSERT INTO config (key, value, active) VALUES (?, ?, ?) RETURNING *'
    )
      .bind(data.key, encryptedValue, data.active ?? true)
      .first();

    if (!result) {
      throw new Error('Failed to create config');
    }

    return result;
  }

  async update(
    id: string,
    data: { key: string; value?: string | null; active?: boolean }
  ) {
    const encryptedValue = data.value
      ? encrypt(
          data.value,
          this.env.ENCRYPTION_KEY || 'default-secret-key-12345678'
        )
      : null;
    const result = await this.env.DB.prepare(
      'UPDATE config SET key = ?, value = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted = 0 RETURNING *'
    )
      .bind(data.key, encryptedValue, data.active ?? true, id)
      .first();

    return result;
  }

  async softDelete(id: string) {
    await this.env.DB.prepare(
      'UPDATE config SET deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(id)
      .run();
  }
}

