const PAGES_TO_PICK = 2;

/**
 * Fetches the raw HTML from a given URL.
 * @param url The URL to fetch
 * @returns The raw HTML string
 */
export async function fetchBookPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`
    );
  }
  return response.text();
}

/**
 * Parses HTML from taphuan.nxbgd.vn to extract book data.
 * Collects all cdn3.olm.vn image URLs into an ordered array
 * (index 0 = cover, index N = page N), then picks images
 * starting from currentPage.
 */
export function parseBookData(
  html: string,
  currentPage: number
): {
  title: string;
  totalPages: number;
  images: { pageNumber: number; imageUrl: string }[];
} {
  // Extract title from <title> tag, strip " - Thư viện số" suffix
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const rawTitle = titleMatch ? titleMatch[1] : 'Unknown';
  const title = rawTitle.replace(/\s*-\s*Thư viện số$/, '').trim();

  // Extract totalPages from TRAINING_READER.init({ ... totalPages: N ... })
  const totalPagesMatch = html.match(/totalPages:\s*(\d+)/);
  const totalPages = totalPagesMatch ? parseInt(totalPagesMatch[1], 10) : 0;

  // Collect all cdn3.olm.vn image URLs in document order
  // Index 0 = cover image, index N = page N
  const allImages: string[] = [];
  const imgRegex = /(?:src|data-src)="(https?:\/\/cdn3\.olm\.vn[^"]+)"/g;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    allImages.push(match[1]);
  }

  // Pick images dynamically based on currentPage
  // e.g. currentPage=3 → indices [3, 4] → page 3 and page 4
  const images: { pageNumber: number; imageUrl: string }[] = [];
  for (let i = 0; i < PAGES_TO_PICK; i++) {
    const idx = currentPage + i;
    if (idx < allImages.length) {
      images.push({
        pageNumber: currentPage + i,
        imageUrl: allImages[idx]
      });
    }
  }

  return { title, totalPages, images };
}

