import { chatWithCloudflare } from './ocr';

/**
 * Heuristic-based Vietnamese review.
 * Flags words that contain characters not in the standard Vietnamese alphabet (f, j, w, z).
 */
export function reviewVietnameseHeuristic(markdown: string): string | null {
  if (!markdown) return null;

  const words = markdown.match(/\p{L}+/gu) || [];
  const suspiciousWords = new Set<string>();
  const nonVietnameseChars = /[fjwz]/i;
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

const VIETNAMESE_REVIEW_PROMPT = `Vietnamese Linguistic Accuracy Prompt
Role: Act as a Senior Vietnamese Linguist and Professional Editor specializing in Lexicology.

Task: Analyze the provided text to identify any elements that do not conform to standard Vietnamese vocabulary, grammar, or formal orthography.

Detection Scope:
- Non-Vietnamese Words: Foreign words (English, French, etc.) used unnecessarily when a Vietnamese equivalent exists.
- Hybrid Slang: "Teencode" or "Viet-lish" (e.g., "rùi", "okela", "book lịch").
- Sino-Vietnamese Misuse: Incorrectly used Hán-Việt terms.
- Spelling Errors: Typos that result in non-existent Vietnamese words.

Output Format: Please present the results in a clear table with the following columns:
1. Original Term: The non-Vietnamese or incorrect word found.
2. Classification: (Foreign Word / Slang / Spelling Error / Loanword).
3. Context: A brief snippet of the sentence where it appeared.
4. Vietnamese Suggestion: The most appropriate, pure Vietnamese or standardized replacement.
5. Reasoning: Why the replacement is better (formal tone, clarity, or linguistic purity).

Constraint: After the table, provide a Refined Version of the entire text that is 100% natural, formal, and grammatically correct Vietnamese.`;

/**
 * Enhanced Vietnamese review using Cloudflare Workers AI.
 * Falls back to heuristic if AI binding is not provided.
 */
export async function reviewVietnameseMarkdown(
  markdown: string,
  ai?: any,
  model: string = '@cf/meta/llama-3-8b-instruct'
): Promise<string | null> {
  if (!markdown) return null;

  if (ai) {
    try {
      return await chatWithCloudflare(VIETNAMESE_REVIEW_PROMPT, markdown, ai, model);
    } catch (error) {
      console.error('AI Review failed, falling back to heuristic:', error);
    }
  }

  return reviewVietnameseHeuristic(markdown);
}
