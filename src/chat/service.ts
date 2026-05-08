import { Env } from '../types';

export interface ChatMessage {
  id?: number;
  session_id?: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: any;
  created_at?: string;
}

export class ChatService {
  constructor(private env: Env) {}

  async saveMessage(message: ChatMessage) {
    const { session_id, role, content, metadata } = message;
    const metadataStr = metadata ? JSON.stringify(metadata) : null;

    const result = await this.env.DB.prepare(
      'INSERT INTO chat_log (session_id, role, content, metadata) VALUES (?, ?, ?, ?) RETURNING *'
    )
      .bind(session_id || null, role, content, metadataStr)
      .first<ChatMessage>();

    return result;
  }

  async getHistory(session_id: string, limit: number = 10) {
    const { results } = await this.env.DB.prepare(
      'SELECT * FROM chat_log WHERE session_id = ? ORDER BY created_at DESC LIMIT ?'
    )
      .bind(session_id, limit)
      .all<ChatMessage>();

    // Reverse to get chronological order
    return results.reverse();
  }
}
