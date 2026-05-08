export interface Book {
  id: number;
  title: string;
  unsigned_title?: string | null;
  description?: string | null;
  url?: string | null;
  total_pages?: number;
  deleted: number;
  created_at: string;
  updated_at: string;
}

export interface BookPage {
  id: number;
  book_id: number;
  page_number: number;
  image_url?: string | null;
  ocr_process_id?: number | null;
  html_content?: string | null;
  deleted: number;
  created_at: string;
  updated_at: string;
}

export interface OcrProcess {
  id: number;
  book_page_id: number;
  markdown?: string | null;
  status: string;
  review?: string | null;
  deleted: number;
  created_at: string;
  updated_at: string;
}

export interface OcrFail {
  id: number;
  book_page_id?: number | null;
  reason?: string | null;
  deleted: number;
  created_at: string;
  updated_at: string;
}

export interface Config {
  id: number;
  key: string;
  value?: string | null;
  active: number;
  deleted: number;
  created_at: string;
  updated_at: string;
}

export interface ChatLog {
  id: number;
  session_id?: string | null;
  role: 'user' | 'assistant';
  content: string;
  metadata?: string | null;
  created_at: string;
}
