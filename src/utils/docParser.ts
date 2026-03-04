/** A single word extracted from the Google Doc */
export interface Word {
  text: string          // original text including punctuation
  normalized: string   // lowercase, stripped of punctuation — used for matching
  index: number        // position in the flat word list
  paragraphIndex: number
}

/** Full parsed representation of a Google Doc */
export interface ParsedDoc {
  title: string
  words: Word[]
  /** Each entry is an array of word indices belonging to that paragraph */
  paragraphs: number[][]
}

/** Strip punctuation and lowercase a word for fuzzy matching */
export function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9']/g, '')
}

/**
 * Parse a raw text string into a ParsedDoc.
 * Splits on blank lines (or consecutive newlines) for paragraph boundaries,
 * then on whitespace for individual words. Works for any text source
 * (Milanote copy-paste, file upload, etc.).
 */
export function parseRawText(title: string, rawText: string): ParsedDoc {
  const words: Word[] = []
  const paragraphs: number[][] = []
  let wordIndex = 0

  // Split into paragraphs on one or more blank lines
  const rawParagraphs = rawText.split(/\n\s*\n|\r\n\s*\r\n/)

  for (const para of rawParagraphs) {
    const paraWordIndices: number[] = []
    // Collapse internal newlines to spaces, then split on whitespace
    const paraText = para.replace(/[\r\n]+/g, ' ')

    for (const token of paraText.split(/\s+/)) {
      const trimmed = token.trim()
      if (!trimmed) continue
      const normalized = normalizeWord(trimmed)
      if (!normalized) continue

      words.push({ text: trimmed, normalized, index: wordIndex, paragraphIndex: paragraphs.length })
      paraWordIndices.push(wordIndex)
      wordIndex++
    }

    if (paraWordIndices.length > 0) {
      paragraphs.push(paraWordIndices)
    }
  }

  return { title, words, paragraphs }
}

/**
 * Fetch a Google Doc by ID and parse it into a flat word list.
 * Traverses body.content → paragraphs → textRun elements.
 */
export async function fetchAndParseDoc(
  docId: string,
  accessToken: string,
): Promise<ParsedDoc> {
  const response = await fetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(docId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(
      body?.error?.message ?? `Could not load document (HTTP ${response.status})`,
    )
  }

  const doc = await response.json() as GoogleDoc

  // Extract all paragraph text from the Google Docs structure
  const textChunks: string[] = []
  for (const structElement of doc.body?.content ?? []) {
    if (!structElement.paragraph) continue
    let paraText = ''
    for (const element of structElement.paragraph.elements ?? []) {
      if (element.textRun?.content) {
        paraText += element.textRun.content
      }
    }
    const trimmed = paraText.trim()
    if (trimmed) textChunks.push(trimmed)
  }

  return parseRawText(doc.title ?? 'Untitled Document', textChunks.join('\n\n'))
}

/**
 * Extract the document ID from a Google Docs URL or return the string
 * as-is if it looks like a bare document ID.
 */
export function extractDocId(input: string): string | null {
  const urlMatch = input.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
  if (urlMatch) return urlMatch[1]
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) return input.trim()
  return null
}

// ---------------------------------------------------------------------------
// Minimal types for the Google Docs REST API response
// ---------------------------------------------------------------------------
interface GoogleDoc {
  title?: string
  body?: { content?: StructuralElement[] }
}
interface StructuralElement {
  paragraph?: { elements?: ParagraphElement[] }
}
interface ParagraphElement {
  textRun?: { content?: string }
}
