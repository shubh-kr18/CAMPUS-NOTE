/**
 * Reusable chunking service for semantic search and RAG preparation.
 *
 * Defaults:
 *  - chunkSize: 600 characters (~100–120 words)
 *  - overlap: 120 characters (~20–25 words)
 */

export const DEFAULT_CHUNK_SIZE = 600
export const DEFAULT_CHUNK_OVERLAP = 120

/**
 * Splits a single text string into overlapping chunks without breaking words.
 *
 * @param {string} text - Raw text to split.
 * @param {Object} [options]
 * @param {number} [options.chunkSize=600]
 * @param {number} [options.overlap=120]
 * @returns {string[]} Array of chunk text strings.
 */
export function chunkText(text, options = {}) {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE
  const overlap = options.overlap || DEFAULT_CHUNK_OVERLAP

  const cleanText = (text || '').replace(/\r\n/g, '\n').trim()
  if (!cleanText) return []
  if (cleanText.length <= chunkSize) return [cleanText]

  const chunks = []
  let start = 0

  while (start < cleanText.length) {
    let end = start + chunkSize

    if (end >= cleanText.length) {
      const slice = cleanText.slice(start).trim()
      if (slice) chunks.push(slice)
      break
    }

    // Try finding natural boundaries near 'end' (sentence ends, newlines, spaces)
    let splitPos = -1
    for (const sep of ['. ', '? ', '! ', '\n\n', '\n', ' ']) {
      const idx = cleanText.lastIndexOf(sep, end)
      if (idx > start + overlap) {
        splitPos = idx + (sep.trim() ? sep.length : 0)
        break
      }
    }

    if (splitPos === -1) splitPos = end

    const chunk = cleanText.slice(start, splitPos).trim()
    if (chunk) chunks.push(chunk)

    // Advance start position with overlap, snapping forward to next word boundary
    let nextStart = Math.max(start + 1, splitPos - overlap)
    const nextSpace = cleanText.indexOf(' ', nextStart)
    if (nextSpace !== -1 && nextSpace < splitPos) {
      nextStart = nextSpace + 1
    }

    start = nextStart
  }

  return chunks
}

/**
 * Chunks an array of extracted PDF pages into ordered chunks, preserving page numbers.
 *
 * @param {Array<{ pageNumber: number, text: string }>} pages - Array of extracted pages.
 * @param {Object} [options]
 * @param {number} [options.chunkSize=600]
 * @param {number} [options.overlap=120]
 * @returns {Array<{ chunkIndex: number, pageNumber: number, text: string, charCount: number }>}
 */
export function chunkPages(pages = [], options = {}) {
  const result = []
  let chunkIndex = 0

  for (const page of pages) {
    if (!page.text || !page.text.trim()) continue

    const textChunks = chunkText(page.text, options)
    for (const text of textChunks) {
      result.push({
        chunkIndex: chunkIndex++,
        pageNumber: page.pageNumber,
        text,
        charCount: text.length
      })
    }
  }

  return result
}
