export type ItemKind = 'decision' | 'blocker' | 'change'

/**
 * Links always point from a newer item to an older one:
 * "this item <type> that earlier item".
 */
export type LinkType = 'revises' | 'blocks' | 'resolves' | 'builds_on'

export interface Person {
  name: string
  role?: string
}

export interface TranscriptLine {
  /** Seconds from the start of the meeting. */
  t: number
  speaker: string
  text: string
}

export type Engine = 'sample' | 'claude' | 'on-device'

export interface Meeting {
  id: string
  title: string
  /** ISO date-time. */
  date: string
  durationMin: number
  attendees: string[]
  transcript: TranscriptLine[]
  engine: Engine
}

export interface Thread {
  id: string
  name: string
}

export interface TrailItem {
  id: string
  meetingId: string
  threadId: string
  kind: ItemKind
  title: string
  summary: string
  owner?: string
  /** Inclusive transcript line indices that support this item. */
  evidence: { start: number; end: number }
  links: { to: string; type: LinkType }[]
  confidence: number
}

export interface Workspace {
  people: Record<string, Person>
  meetings: Meeting[]
  threads: Thread[]
  items: TrailItem[]
}
