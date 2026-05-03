import { Env } from '../types';
import { fetchBookPage, parseBookData } from '../utils/crawler';
import { toNonAccentVietnamese } from '../utils/string';

export class CrawlService {
  constructor(private env: Env) {}

  async crawl(url: string) {
    const baseUrl = url?.split('#')[0] || url;
    let book = await this.env.DB.prepare(
      'SELECT * FROM book WHERE url = ? AND deleted = 0'
    )
      .bind(baseUrl)
      .first<any>();
      
    // Fetch and parse the HTML
    const html = await fetchBookPage(baseUrl);
    const { title, totalPages, images } = parseBookData(html);
    const unsignedTitle = toNonAccentVietnamese(title);

    // Upsert book by URL
    if (book) {
      await this.env.DB.prepare(
        'UPDATE book SET title = ?, unsigned_title = ?, total_pages = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      )
        .bind(title, unsignedTitle, totalPages, book.id)
        .run();
      book = {
        ...book,
        title,
        unsigned_title: unsignedTitle,
        total_pages: totalPages
      };
    } else {
      book = await this.env.DB.prepare(
        'INSERT INTO book (title, unsigned_title, url, total_pages) VALUES (?, ?, ?, ?) RETURNING *'
      )
        .bind(title, unsignedTitle, baseUrl, totalPages)
        .first<any>();
    }

    // Insert book pages (index 0 = cover, index N = page N)
    let pagesInserted = 0;
    for (let i = 0; i < images.length; i++) {
      const pageNumber = i;
      // Skip if page already exists for this book
      const existing = await this.env.DB.prepare(
        'SELECT id FROM book_page WHERE book_id = ? AND page_number = ? AND deleted = 0'
      )
        .bind(book.id, pageNumber)
        .first();

      if (!existing) {
        await this.env.DB.prepare(
          'INSERT INTO book_page (book_id, page_number, image_url) VALUES (?, ?, ?)'
        )
          .bind(book.id, pageNumber, images[i])
          .run();
        pagesInserted++;
      }
    }

    return {
      book: { id: book.id, title: book.title, total_pages: totalPages },
      pages_inserted: pagesInserted
    };
  }
}
