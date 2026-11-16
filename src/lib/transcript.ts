import type { TranscriptLine } from '../types'

// "[04:26] Maya Chen: text", "04:26 Maya Chen: text" or "[1:04:26] ..."
const TIMED = /^\s*\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\s*[-–—]?\s*([^:[\]]{1,48}?):\s+(.+)$/
// "Maya Chen: text" (no timestamps)
const UNTIMED = /^\s*([A-Z][^:[\]]{0,47}?):\s+(.+)$/

export function parseTimestamp(s: string): number {
  return s.split(':').reduce((acc, part) => acc * 60 + Number(part), 0)
}

export function formatTimestamp(t: number): string {
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = Math.floor(t % 60)
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Parses a plain-text transcript. Lines that match no speaker join the previous line. */
export function parseTranscript(text: string): TranscriptLine[] {
  const lines: TranscriptLine[] = []
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue
    const timed = TIMED.exec(raw)
    if (timed) {
      lines.push({ t: parseTimestamp(timed[1]), speaker: timed[2].trim(), text: timed[3].trim() })
      continue
    }
    const untimed = UNTIMED.exec(raw)
    if (untimed) {
      const prev = lines.at(-1)
      lines.push({ t: prev ? prev.t + 15 : 0, speaker: untimed[1].trim(), text: untimed[2].trim() })
      continue
    }
    const prev = lines.at(-1)
    if (prev) prev.text += ' ' + raw.trim()
  }
  return lines
}

export function speakersOf(lines: TranscriptLine[]): string[] {
  return [...new Set(lines.map((l) => l.speaker))]
}
