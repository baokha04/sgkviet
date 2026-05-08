/**
 * Simple Vietnamese spell check and language detection for OCR results.
 * Flags words that contain characters not in the standard Vietnamese alphabet (f, j, w, z).
 */
export function reviewVietnameseMarkdown(markdown: string): string | null {
  if (!markdown) return null;

  // Split into words, ignoring numbers and symbols
  const words = markdown.match(/\p{L}+/gu) || [];
  const suspiciousWords = new Set<string>();

  const nonVietnameseChars = /[fjwz]/i;
  
  // Common technical words or markdown keywords to ignore
  const ignoredWords = new Set(['markdown', 'http', 'https', 'img', 'src', 'alt', 'width', 'height', 'style', 'class', 'div', 'span', 'br', 'li', 'ul', 'ol', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'caption', 'blockquote', 'pre', 'code', 'em', 'strong', 'ins', 'del', 'sup', 'sub', 'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base', 'bdi', 'bdo', 'body', 'button', 'canvas', 'cite', 'col', 'colgroup', 'data', 'datalist', 'dd', 'details', 'dfn', 'dialog', 'dir', 'dl', 'dt', 'embed', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'input', 'kbd', 'label', 'legend', 'main', 'map', 'mark', 'menu', 'meta', 'meter', 'nav', 'noscript', 'object', 'optgroup', 'option', 'output', 'param', 'picture', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'section', 'select', 'small', 'source', 'summary', 'svg', 'textarea', 'time', 'title', 'track', 'u', 'var', 'video', 'wbr']);

  for (const word of words) {
    const lowerWord = word.toLowerCase();
    if (lowerWord.length < 2) continue;
    if (ignoredWords.has(lowerWord)) continue;

    if (nonVietnameseChars.test(word)) {
      suspiciousWords.add(word);
    }
  }

  if (suspiciousWords.size > 0) {
    const list = Array.from(suspiciousWords);
    return `Suspicious words: ${list.slice(0, 10).join(', ')}${list.length > 10 ? '...' : ''}`;
  }

  return 'Passed';
}
