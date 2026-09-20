import fs from 'fs/promises'
import { PDFParse } from 'pdf-parse'

/**
 * Extract text page-by-page from a PDF file using pdf-parse.
 *
 * @param {string} filePath - Absolute path to the PDF on disk.
 * @returns {Promise<Array<{ pageNumber: number, text: string }>>}
 */
export async function extractPagesFromPdf(filePath) {
  const buffer = await fs.readFile(filePath)
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    const pages = (result.pages || []).map(page => ({
      pageNumber: page.num,
      text: (page.text || '').trim()
    }))

    // Ensure ascending order by page number
    pages.sort((a, b) => a.pageNumber - b.pageNumber)
    return pages
  } finally {
    await parser.destroy().catch(() => {})
  }
}
