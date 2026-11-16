import type { ItemKind, LinkType, Meeting, Thread, TrailItem, Workspace } from '../../types'

/** What an extraction engine returns, before it is checked against the workspace. */
export interface RawItem {
  kind: string
  title: string
  summary?: string
  owner?: string | null
  /** An existing thread ID, or a name for a new thread. */
  thread: string
  evidence: { start: number; end: number }
  links?: { to: string; type: string }[]
  confidence?: number
}

const KINDS: ItemKind[] = ['decision', 'blocker', 'change']
const LINKS: LinkType[] = ['revises', 'blocks', 'resolves', 'builds_on']

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'topic'
}

/**
 * Adds a meeting and its extracted items to the workspace. Drops items with
 * unknown kinds, clamps evidence to the transcript, keeps only links to
 * items from earlier meetings, and creates threads for new topic names.
 */
export function applyExtraction(
  ws: Workspace,
  meeting: Meeting,
  raw: RawItem[],
): { workspace: Workspace; itemIds: string[] } {
  const threads: Thread[] = [...ws.threads]
  const earlier = new Set(
    ws.items
      .filter((it) => ws.meetings.find((m) => m.id === it.meetingId)!.date <= meeting.date)
      .map((it) => it.id),
  )
  const last = Math.max(0, meeting.transcript.length - 1)
  const clamp = (n: unknown) => Math.min(last, Math.max(0, Math.round(Number(n) || 0)))

  const threadFor = (ref: string): string => {
    const name = String(ref ?? '').trim() || 'New topics'
    const found = threads.find((t) => t.id === name || t.name.toLowerCase() === name.toLowerCase())
    if (found) return found.id
    let id = slug(name)
    while (threads.some((t) => t.id === id)) id += '-2'
    threads.push({ id, name })
    return id
  }

  const items: TrailItem[] = raw
    .filter((r) => KINDS.includes(r.kind as ItemKind) && String(r.title ?? '').trim())
    .map((r, i) => {
      const a = clamp(r.evidence?.start)
      const b = clamp(r.evidence?.end ?? r.evidence?.start)
      return {
        id: `${meeting.id}-${i + 1}`,
        meetingId: meeting.id,
        threadId: threadFor(r.thread),
        kind: r.kind as ItemKind,
        title: String(r.title).trim(),
        summary: String(r.summary ?? '').trim(),
        owner: r.owner?.trim() || undefined,
        evidence: { start: Math.min(a, b), end: Math.max(a, b) },
        links: (r.links ?? [])
          .filter((l) => earlier.has(l.to) && LINKS.includes(l.type as LinkType))
          .map((l) => ({ to: l.to, type: l.type as LinkType })),
        confidence: Math.min(1, Math.max(0, Number(r.confidence ?? 0.8))),
      }
    })

  return {
    workspace: { ...ws, threads, meetings: [...ws.meetings, meeting], items: [...ws.items, ...items] },
    itemIds: items.map((it) => it.id),
  }
}
