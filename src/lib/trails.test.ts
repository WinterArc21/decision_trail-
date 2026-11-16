import { describe, expect, it } from 'vitest'
import { sampleWorkspace as ws } from '../data/workspace'
import { retroExample } from '../data/transcripts'
import { edgesOf, statusesOf, threadNow } from './graph'
import { extractHeuristic } from './extract/heuristic'
import { applyExtraction } from './extract/normalize'
import { parseTranscript } from './transcript'
import type { Meeting } from '../types'

describe('parseTranscript', () => {
  it('reads timestamps, speakers, and continuation lines', () => {
    const lines = parseTranscript('[01:05] Maya Chen: First line\nstill Maya\n\n1:02:03 Leo: Ratio is 3:1 here')
    expect(lines).toEqual([
      { t: 65, speaker: 'Maya Chen', text: 'First line still Maya' },
      { t: 3723, speaker: 'Leo', text: 'Ratio is 3:1 here' },
    ])
  })
})

describe('sample workspace', () => {
  it('links every item only to items from the same or earlier meetings', () => {
    const date = new Map(ws.meetings.map((m) => [m.id, m.date]))
    const item = new Map(ws.items.map((i) => [i.id, i]))
    for (const e of edgesOf(ws)) {
      expect(date.get(item.get(e.from)!.meetingId)! <= date.get(item.get(e.to)!.meetingId)!).toBe(true)
    }
    expect(edgesOf(ws)).toHaveLength(ws.items.reduce((n, i) => n + i.links.length, 0))
  })

  it('knows which decisions were revised and which blockers are still open', () => {
    const s = statusesOf(ws)
    const superseded = ws.items.filter((i) => s[i.id].supersededBy).map((i) => i.id)
    expect(superseded.sort()).toEqual(['builder', 'ga-oct14', 'matviews', 'pro-included'])
    const open = ws.items.filter((i) => i.kind === 'blocker' && !s[i.id].resolvedBy).map((i) => i.id)
    expect(open).toEqual(['billing'])
    expect(s['addon'].blockedBy).toBe('billing')
    expect(threadNow(ws, s, 'launch').current?.id).toBe('go')
  })
})

describe('on-device extraction of the retro', () => {
  const transcript = parseTranscript(retroExample)
  const meeting: Meeting = {
    id: 'retro', title: 'Pulse retro', date: '2026-11-12T12:00:00', durationMin: 13,
    attendees: [], transcript, engine: 'on-device',
  }
  const raw = extractHeuristic(ws, meeting)
  const { workspace, itemIds } = applyExtraction(ws, meeting, raw)
  const items = itemIds.map((id) => workspace.items.find((i) => i.id === id)!)
  const at = (stamp: string) => transcript.findIndex((l) => l.text === transcript.find((x) => x.t === toSec(stamp))!.text)
  const toSec = (s: string) => s.split(':').reduce((a, b) => a * 60 + Number(b), 0)

  it('finds the four outcomes and nothing from the recap or status updates', () => {
    expect(items.map((i) => [i.kind, i.threadId, i.evidence.start])).toEqual([
      ['decision', 'pricing', at('01:20')],
      ['blocker', 'architecture', at('03:10')],
      ['change', 'onboarding', at('06:34')],
      ['decision', 'security', at('09:20')],
    ])
  })

  it('links the add-on billing decision as resolving the open billing blocker', () => {
    expect(items[0].links).toEqual([{ to: 'billing', type: 'resolves' }])
    expect(statusesOf(workspace)['billing'].resolvedBy).toBe(items[0].id)
    expect(items[1].links.map((l) => l.type)).toEqual(['blocks'])
    expect(items[2].links.map((l) => l.type)).toEqual(['revises'])
  })

  it('writes short, readable titles', () => {
    expect(items.map((i) => i.title)).toEqual([
      'Start billing the add-on on December 1',
      'ClickHouse costs are running forty percent over budget because…',
      'Go with the lighter builder for v1.1',
      "Don't commit to EU data residency this quarter",
    ])
  })
})

describe('applyExtraction', () => {
  it('drops unknown kinds and links, clamps evidence, and creates new threads by name', () => {
    const meeting: Meeting = {
      id: 'x', title: 'X', date: '2026-12-01T00:00:00', durationMin: 1, attendees: [], engine: 'claude',
      transcript: parseTranscript('[00:01] A: one\n[00:02] B: two'),
    }
    const { workspace, itemIds } = applyExtraction(ws, meeting, [
      { kind: 'decision', title: 'Keep', thread: 'Hiring plan', evidence: { start: 5, end: -1 },
        links: [{ to: 'go', type: 'builds_on' }, { to: 'nope', type: 'builds_on' }, { to: 'go', type: 'likes' }] },
      { kind: 'action', title: 'Drop me', thread: 'launch', evidence: { start: 0, end: 0 } },
      { kind: 'change', title: 'Same thread by name', thread: 'launch date', evidence: { start: 0, end: 0 } },
    ])
    expect(itemIds).toHaveLength(2)
    const [a, b] = itemIds.map((id) => workspace.items.find((i) => i.id === id)!)
    expect(a.evidence).toEqual({ start: 0, end: 1 })
    expect(a.links).toEqual([{ to: 'go', type: 'builds_on' }])
    expect(workspace.threads.find((t) => t.id === a.threadId)?.name).toBe('Hiring plan')
    expect(b.threadId).toBe('launch')
  })
})
