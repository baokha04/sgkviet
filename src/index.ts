import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { encrypt, decrypt } from './utils/crypto';
import { fetchBookPage, parseBookData } from './utils/crawler';
import { toNonAccentVietnamese } from './utils/string';
import { processImagesWithOpenRouter } from './utils/ocr';

export interface Env {
  DB: D1Database;
  ENCRYPTION_KEY: string;
}

const app = new OpenAPIHono<{ Bindings: Env }>();

// --- Schemas ---

const IdSchema = z.object({
  id: z.string().openapi({ param: { name: 'id', in: 'path' }, example: '1' })
});

const BookSchema = z.object({
  id: z.number().optional(),
  title: z.string(),
  unsigned_title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  total_pages: z.number().optional(),
  deleted: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

const BookPageSchema = z.object({
  id: z.number().optional(),
  book_id: z.number(),
  page_number: z.number(),
  image_url: z.string().nullable().optional(),
  html_content: z.string().nullable().optional(),
  ocr_process_id: z.number().nullable().optional(),
  deleted: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

const OcrProcessSchema = z.object({
  id: z.number().optional(),
  book_page_id: z.number(),
  markdown: z.string().nullable().optional(),
  status: z.string(),
  deleted: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

const OcrFailSchema = z.object({
  id: z.number().optional(),
  book_page_id: z.number().nullable().optional(),
  reason: z.string().nullable().optional(),
  deleted: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

const ConfigSchema = z.object({
  id: z.number().optional(),
  key: z.string(),
  value: z.string().nullable().optional(),
  active: z.boolean().optional(),
  deleted: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

// --- Book Routes ---

app.openapi(
  createRoute({
    method: 'get',
    path: '/books',
    responses: {
      200: {
        content: { 'application/json': { schema: z.array(BookSchema) } },
        description: 'List books'
      }
    }
  }),
  async (c) => {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM book WHERE deleted = 0'
    ).all<any>();
    return c.json(results as any, 200);
  }
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/books',
    request: {
      body: { content: { 'application/json': { schema: BookSchema } } }
    },
    responses: {
      201: {
        content: { 'application/json': { schema: BookSchema } },
        description: 'Create book'
      }
    }
  }),
  async (c) => {
    const body = await c.req.json();
    const result = await c.env.DB.prepare(
      'INSERT INTO book (title, unsigned_title, description, url) VALUES (?, ?, ?, ?) RETURNING *'
    )
      .bind(
        body.title,
        body.unsigned_title || null,
        body.description || null,
        body.url || null
      )
      .first();

    if (!result) {
      throw new Error('Failed to create book');
    }

    return c.json(result as any, 201);
  }
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/books/{id}',
    request: { params: IdSchema },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.boolean() }) }
        },
        description: 'Soft delete book'
      }
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    await c.env.DB.prepare(
      'UPDATE book SET deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(id)
      .run();
    return c.json({ success: true });
  }
);

// --- Config Routes (with Encryption) ---

app.openapi(
  createRoute({
    method: 'get',
    path: '/configs',
    responses: {
      200: {
        content: { 'application/json': { schema: z.array(ConfigSchema) } },
        description: 'List configs (decrypted)'
      }
    }
  }),
  async (c) => {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM config WHERE deleted = 0'
    ).all<any>();
    const decryptedResults = results.map((row: any) => ({
      ...row,
      value: row.value
        ? decrypt(
            row.value,
            c.env.ENCRYPTION_KEY || 'default-secret-key-12345678'
          )
        : row.value
    }));
    return c.json(decryptedResults as any, 200);
  }
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/configs',
    request: {
      body: { content: { 'application/json': { schema: ConfigSchema } } }
    },
    responses: {
      201: {
        content: { 'application/json': { schema: ConfigSchema } },
        description: 'Create config (encrypted)'
      }
    }
  }),
  async (c) => {
    const body = await c.req.json();
    const encryptedValue = body.value
      ? encrypt(
          body.value,
          c.env.ENCRYPTION_KEY || 'default-secret-key-12345678'
        )
      : null;
    const result = await c.env.DB.prepare(
      'INSERT INTO config (key, value, active) VALUES (?, ?, ?) RETURNING *'
    )
      .bind(body.key, encryptedValue, body.active ?? true)
      .first();

    if (!result) {
      throw new Error('Failed to create config');
    }

    return c.json(result as any, 201);
  }
);

app.openapi(
  createRoute({
    method: 'put',
    path: '/configs/{id}',
    request: {
      params: IdSchema,
      body: { content: { 'application/json': { schema: ConfigSchema } } }
    },
    responses: {
      200: {
        content: { 'application/json': { schema: ConfigSchema } },
        description: 'Update config (encrypted)'
      },
      404: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) }
        },
        description: 'Config not found'
      }
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const body = await c.req.json();
    const encryptedValue = body.value
      ? encrypt(
          body.value,
          c.env.ENCRYPTION_KEY || 'default-secret-key-12345678'
        )
      : null;
    const result = await c.env.DB.prepare(
      'UPDATE config SET key = ?, value = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted = 0 RETURNING *'
    )
      .bind(body.key, encryptedValue, body.active ?? true, id)
      .first();

    if (!result) {
      return c.json({ error: 'Config not found' }, 404);
    }

    return c.json(result as any, 200);
  }
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/configs/{id}',
    request: { params: IdSchema },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.boolean() }) }
        },
        description: 'Soft delete config'
      }
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    await c.env.DB.prepare(
      'UPDATE config SET deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(id)
      .run();
    return c.json({ success: true });
  }
);

// --- Remaining CRUD (BookPage, OcrProcess, OcrFail) ---

// BookPage
app.openapi(
  createRoute({
    method: 'get',
    path: '/book_pages',
    responses: {
      200: {
        content: { 'application/json': { schema: z.array(BookPageSchema) } },
        description: 'List book pages'
      }
    }
  }),
  async (c) => {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM book_page WHERE deleted = 0'
    ).all<any>();
    return c.json(results as any, 200);
  }
);
app.openapi(
  createRoute({
    method: 'post',
    path: '/book_pages',
    request: {
      body: { content: { 'application/json': { schema: BookPageSchema } } }
    },
    responses: {
      201: {
        content: { 'application/json': { schema: BookPageSchema } },
        description: 'Create book page'
      }
    }
  }),
  async (c) => {
    const body = await c.req.json();
    const result = await c.env.DB.prepare(
      'INSERT INTO book_page (book_id, page_number, image_url, ocr_process_id) VALUES (?, ?, ?, ?) RETURNING *'
    )
      .bind(
        body.book_id,
        body.page_number,
        body.image_url || null,
        body.ocr_process_id || null
      )
      .first();

    if (!result) {
      throw new Error('Failed to create book page');
    }

    return c.json(result as any, 201);
  }
);
app.openapi(
  createRoute({
    method: 'delete',
    path: '/book_pages/{id}',
    request: { params: IdSchema },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.boolean() }) }
        },
        description: 'Soft delete book page'
      }
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    await c.env.DB.prepare(
      'UPDATE book_page SET deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(id)
      .run();
    return c.json({ success: true });
  }
);

// OcrProcess
app.openapi(
  createRoute({
    method: 'get',
    path: '/ocr_processes',
    responses: {
      200: {
        content: { 'application/json': { schema: z.array(OcrProcessSchema) } },
        description: 'List OCR processes'
      }
    }
  }),
  async (c) => {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM ocr_process WHERE deleted = 0'
    ).all<any>();
    return c.json(results as any, 200);
  }
);
app.openapi(
  createRoute({
    method: 'post',
    path: '/ocr_processes',
    request: {
      body: { content: { 'application/json': { schema: OcrProcessSchema } } }
    },
    responses: {
      201: {
        content: { 'application/json': { schema: OcrProcessSchema } },
        description: 'Create OCR process'
      }
    }
  }),
  async (c) => {
    const body = await c.req.json();
    const result = await c.env.DB.prepare(
      'INSERT INTO ocr_process (book_page_id, markdown, status) VALUES (?, ?, ?) RETURNING *'
    )
      .bind(body.book_page_id, body.markdown || null, body.status)
      .first();

    if (!result) {
      throw new Error('Failed to create OCR process');
    }

    return c.json(result as any, 201);
  }
);
app.openapi(
  createRoute({
    method: 'delete',
    path: '/ocr_processes/{id}',
    request: { params: IdSchema },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.boolean() }) }
        },
        description: 'Soft delete OCR process'
      }
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    await c.env.DB.prepare(
      'UPDATE ocr_process SET deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(id)
      .run();
    return c.json({ success: true });
  }
);

// OcrFail
app.openapi(
  createRoute({
    method: 'get',
    path: '/ocr_fails',
    responses: {
      200: {
        content: { 'application/json': { schema: z.array(OcrFailSchema) } },
        description: 'List OCR failures'
      }
    }
  }),
  async (c) => {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM ocr_fail WHERE deleted = 0'
    ).all<any>();
    return c.json(results as any, 200);
  }
);
app.openapi(
  createRoute({
    method: 'post',
    path: '/ocr_fails',
    request: {
      body: { content: { 'application/json': { schema: OcrFailSchema } } }
    },
    responses: {
      201: {
        content: { 'application/json': { schema: OcrFailSchema } },
        description: 'Create OCR failure record'
      }
    }
  }),
  async (c) => {
    const body = await c.req.json();
    const result = await c.env.DB.prepare(
      'INSERT INTO ocr_fail (book_page_id, reason) VALUES (?, ?) RETURNING *'
    )
      .bind(body.book_page_id || null, body.reason || null)
      .first();

    if (!result) {
      throw new Error('Failed to create OCR fail record');
    }

    return c.json(result as any, 201);
  }
);
app.openapi(
  createRoute({
    method: 'delete',
    path: '/ocr_fails/{id}',
    request: { params: IdSchema },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.boolean() }) }
        },
        description: 'Soft delete OCR failure'
      }
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    await c.env.DB.prepare(
      'UPDATE ocr_fail SET deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(id)
      .run();
    return c.json({ success: true });
  }
);

// --- Crawl Route ---

const CrawlRequestSchema = z.object({
  url: z.string().url()
});

const CrawlResponseSchema = z.object({
  book: z.object({
    id: z.number(),
    title: z.string(),
    total_pages: z.number()
  }),
  pages_inserted: z.number()
});

const OcrProcessBatchResponseSchema = z.object({
  processed_pages: z.number(),
  success_count: z.number(),
  failure_count: z.number()
});

app.openapi(
  createRoute({
    method: 'post',
    path: '/crawl',
    request: {
      body: { content: { 'application/json': { schema: CrawlRequestSchema } } }
    },
    responses: {
      200: {
        content: { 'application/json': { schema: CrawlResponseSchema } },
        description: 'Crawl a book and store pages'
      }
    }
  }),
  async (c) => {
    const { url } = await c.req.json();
    const baseUrl = url?.split('#')[0] || url;
    let book = await c.env.DB.prepare(
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
      await c.env.DB.prepare(
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
      book = await c.env.DB.prepare(
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
      const existing = await c.env.DB.prepare(
        'SELECT id FROM book_page WHERE book_id = ? AND page_number = ? AND deleted = 0'
      )
        .bind(book.id, pageNumber)
        .first();

      if (!existing) {
        await c.env.DB.prepare(
          'INSERT INTO book_page (book_id, page_number, image_url) VALUES (?, ?, ?)'
        )
          .bind(book.id, pageNumber, images[i])
          .run();
        pagesInserted++;
      }
    }

    return c.json({
      book: { id: book.id, title: book.title, total_pages: totalPages },
      pages_inserted: pagesInserted
    });
  }
);

// --- OCR Process Batch Route ---

app.openapi(
  createRoute({
    method: 'post',
    path: '/ocr/process-batch',
    responses: {
      200: {
        content: {
          'application/json': { schema: OcrProcessBatchResponseSchema }
        },
        description: 'Process a batch of images for OCR'
      },
      500: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) }
        },
        description: 'Server error'
      }
    }
  }),
  async (c) => {
    // 1. Fetch config
    const { results: configs } = await c.env.DB.prepare(
      "SELECT * FROM config WHERE key IN ('OPENROUTER_API_KEY', 'AI_MODEL') AND active = 1 AND deleted = 0"
    ).all<any>();

    let apiKey = '';
    let model = '';

    for (const config of configs) {
      if (config.key === 'OPENROUTER_API_KEY' && config.value) {
        apiKey = decrypt(
          config.value,
          c.env.ENCRYPTION_KEY || 'default-secret-key-12345678'
        );
      } else if (config.key === 'AI_MODEL' && config.value) {
        model = decrypt(
          config.value,
          c.env.ENCRYPTION_KEY || 'default-secret-key-12345678'
        );
      }
    }

    if (!apiKey || !model) {
      return c.json(
        { error: 'Missing OPENROUTER_API_KEY or AI_MODEL config' },
        500
      );
    }

    // 2. Query pending pages
    const { results: pendingPages } = await c.env.DB.prepare(
      'SELECT id, image_url FROM book_page WHERE ocr_process_id IS NULL AND image_url IS NOT NULL AND deleted = 0 LIMIT 5'
    ).all<any>();

    if (pendingPages.length === 0) {
      return c.json(
        { processed_pages: 0, success_count: 0, failure_count: 0 },
        200
      );
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
        const ocrProcess = await c.env.DB.prepare(
          'INSERT INTO ocr_process (book_page_id, markdown, status) VALUES (?, ?, ?) RETURNING id'
        )
          .bind(result.id, result.markdown, 'success')
          .first<any>();

        if (ocrProcess) {
          await c.env.DB.prepare(
            'UPDATE book_page SET ocr_process_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
          )
            .bind(ocrProcess.id, result.id)
            .run();
          successCount++;
        }
      } else {
        await c.env.DB.prepare(
          'INSERT INTO ocr_fail (book_page_id, reason) VALUES (?, ?)'
        )
          .bind(result.id, result.error || 'Unknown error')
          .run();
        failureCount++;
      }
    }

    return c.json(
      {
        processed_pages: pendingPages.length,
        success_count: successCount,
        failure_count: failureCount
      },
      200
    );
  }
);

// --- Swagger ---

app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    title: 'SGKViet API',
    version: '1.0.0'
  }
});

app.get('/swagger', swaggerUI({ url: '/doc' }));

export default app;

