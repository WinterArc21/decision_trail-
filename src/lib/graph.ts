import type { LinkType, Meeting, Thread, TrailItem, Workspace } from '../types'

export const L = {
  laneLabelW: 216,
  headerH: 104,
  colW: 306,
  cardW: 236,
  cardH: 104,
  gapY: 14,
  lanePad: 26,
  endPad: 28,
}

export interface Edge {
  id: string
  /** The older item. */
  from: string
  /** The newer item, which owns the link. */
  to: string
  type: LinkType
}

export interface ItemStatus {
  supersededBy?: string
  resolvedBy?: string
  /** An unresolved blocker that blocks this item. */
  blockedBy?: string
}

export type StatusLabel = 'active' | 'superseded' | 'blocked' | 'open' | 'resolved'

export function sortedMeetings(ws: Workspace): Meeting[] {
  return [...ws.meetings].sort((a, b) => a.date.localeCompare(b.date))
}

export function byId(ws: Workspace): Map<string, TrailItem> {
  return new Map(ws.items.map((it) => [it.id, it]))
}

export function edgesOf(ws: Workspace): Edge[] {
  const items = byId(ws)
  return ws.items.flatMap((it) =>
    it.links
      .filter((l) => items.has(l.to))
      .map((l) => ({ id: `${l.to}->${it.id}`, from: l.to, to: it.id, type: l.type })),
  )
}

export function statusesOf(ws: Workspace): Record<string, ItemStatus> {
  const s: Record<string, ItemStatus> = {}
  for (const it of ws.items) s[it.id] = {}
  for (const it of ws.items) {
    for (const l of it.links) {
      if (!s[l.to]) continue
      if (l.type === 'revises') s[l.to].supersededBy ??= it.id
      if (l.type === 'resolves') s[l.to].resolvedBy ??= it.id
    }
  }
  for (const it of ws.items) {
    if (it.kind !== 'blocker' || s[it.id].resolvedBy) continue
    for (const l of it.links) if (l.type === 'blocks' && s[l.to]) s[l.to].blockedBy ??= it.id
  }
  return s
}

export function statusLabel(item: TrailItem, st: ItemStatus | undefined): StatusLabel {
  if (item.kind === 'blocker') return st?.resolvedBy ? 'resolved' : 'open'
  if (st?.supersededBy) return 'superseded'
  if (st?.blockedBy) return 'blocked'
  return 'active'
}

/** Orders items by meeting date, then by where they occur in the meeting. */
export function chronological(ws: Workspace, items: TrailItem[]): TrailItem[] {
  const order = new Map(sortedMeetings(ws).map((m, i) => [m.id, i]))
  return [...items].sort(
    (a, b) => order.get(a.meetingId)! - order.get(b.meetingId)! || a.evidence.start - b.evidence.start,
  )
}

/** Every item connected to `id` through links, in either direction. */
export function trailOf(ws: Workspace, id: string): Set<string> {
  const adj = new Map<string, string[]>()
  for (const e of edgesOf(ws)) {
    adj.set(e.from, [...(adj.get(e.from) ?? []), e.to])
    adj.set(e.to, [...(adj.get(e.to) ?? []), e.from])
  }
  const seen = new Set([id])
  const queue = [id]
  while (queue.length) {
    for (const next of adj.get(queue.shift()!) ?? []) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return seen
}

/** The thread's current state: its latest active decision or change, and its open blockers. */
export function threadNow(ws: Workspace, statuses: Record<string, ItemStatus>, threadId: string) {
  const items = chronological(ws, ws.items.filter((it) => it.threadId === threadId))
  const current = items.filter((it) => it.kind !== 'blocker' && !statuses[it.id]?.supersededBy).at(-1)
  const openBlockers = items.filter((it) => it.kind === 'blocker' && !statuses[it.id]?.resolvedBy)
  return { current, openBlockers }
}

export interface Pos {
  x: number
  y: number
  col: number
  lane: number
}

export interface Lane {
  thread: Thread
  y: number
  h: number
}

export interface Layout {
  width: number
  bodyH: number
  columns: { meeting: Meeting; x: number; center: number }[]
  lanes: Lane[]
  pos: Record<string, Pos>
}

/** Meetings are columns in date order. Threads are lanes. Items in one cell stack in transcript order. */
export function computeLayout(ws: Workspace): Layout {
  const meetings = sortedMeetings(ws)
  const col = new Map(meetings.map((m, i) => [m.id, i]))
  const cells = new Map<string, TrailItem[]>()
  for (const it of ws.items) {
    const key = `${it.threadId}|${it.meetingId}`
    cells.set(key, [...(cells.get(key) ?? []), it])
  }
  for (const list of cells.values()) list.sort((a, b) => a.evidence.start - b.evidence.start)

  const lanes: Lane[] = []
  const pos: Record<string, Pos> = {}
  let y = 0
  for (const thread of ws.threads) {
    const lists = meetings.map((m) => cells.get(`${thread.id}|${m.id}`) ?? [])
    const n = Math.max(0, ...lists.map((l) => l.length))
    if (n === 0) continue
    const lane = lanes.length
    const h = L.lanePad * 2 + n * L.cardH + (n - 1) * L.gapY
    lists.forEach((list, ci) =>
      list.forEach((it, k) => {
        pos[it.id] = {
          x: L.laneLabelW + ci * L.colW + (L.colW - L.cardW) / 2,
          y: y + L.lanePad + k * (L.cardH + L.gapY),
          col: col.get(it.meetingId)!,
          lane,
        }
      }),
    )
    lanes.push({ thread, y, h })
    y += h
  }

  return {
    width: L.laneLabelW + meetings.length * L.colW + L.endPad,
    bodyH: y,
    columns: meetings.map((meeting, i) => ({
      meeting,
      x: L.laneLabelW + i * L.colW,
      center: L.laneLabelW + i * L.colW + L.colW / 2,
    })),
    lanes,
    pos,
  }
}

/** An SVG path from the older card `a` to the newer card `b`, plus a point for its label. */
export function edgePath(a: Pos, b: Pos): { d: string; mid: { x: number; y: number } } {
  if (a.col === b.col) {
    const x = a.x + 30
    const down = a.y < b.y
    const y1 = down ? a.y + L.cardH : a.y
    const y2 = down ? b.y : b.y + L.cardH
    return { d: `M ${x} ${y1} L ${x} ${y2}`, mid: { x, y: (y1 + y2) / 2 } }
  }
  const x1 = a.x + L.cardW
  const y1 = a.y + L.cardH / 2
  const x2 = b.x
  const y2 = b.y + L.cardH / 2
  if (a.lane === b.lane && Math.abs(b.col - a.col) > 1) {
    // Arc over the cards in the columns between.
    const top = Math.min(a.y, b.y) - 13
    const d = `M ${x1} ${y1} C ${x1 + 30} ${y1}, ${x1 + 30} ${top}, ${x1 + 70} ${top} L ${x2 - 70} ${top} C ${x2 - 30} ${top}, ${x2 - 30} ${y2}, ${x2} ${y2}`
    return { d, mid: { x: (x1 + x2) / 2, y: top } }
  }
  const dx = Math.max(40, (x2 - x1) * 0.5)
  const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
  return { d, mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 } }
}
