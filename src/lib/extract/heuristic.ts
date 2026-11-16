// On-device extraction for when there is no API key. It finds decision,
// blocker, and change cues in the transcript, groups nearby cue lines into
// one item, and uses word overlap with earlier items to pick a thread and
// links. It is a fallback: Claude does this much better.

import type { ItemKind, LinkType, Meeting, TrailItem, Workspace } from '../../types'
import { statusesOf } from '../graph'
import type { RawItem } from './normalize'

const META = /\blet'?s (look|start with|go around|go function|talk|discuss|recap|hear|jump|get started|begin)\b/gi
const CUES: Record<ItemKind, RegExp> = {
  decision: /\b(let'?s|we'?ll|we will|decided|decision made|agreed|locking it in|we're going|it's a go|go with|we launch|we ship)\b/i,
  blocker: /\b(blocker|blocked|blocking|can'?t|cannot|stuck|at risk|waiting on|over budget)\b/i,
  change: /\b(instead of|change the plan|changing|swap|no longer|replace|moves? to|push(?:ed)? to)\b/i,
}
const RESOLVED = /\b(went live|is live|finally|approved|cleared|fixed|resolved|unblocked|landed)\b/i
const LEAD = /^(okay|ok|so|then|agreed|great|right|yeah|yes|honestly|well|alright|heads up|and|but|perfect|good)\b[,.!]?\s*/i
const STOP = new Set(
  'the and for that this with have from they will would what when were been just about into also than then there their them our out can could get got its it\'s let\'s we\'ll we\'re i\'d i\'m you that\'s don\'t isn\'t should which because being does more most some very really think okay yeah right like want need make sure going thing things first last next week weeks today yesterday team everyone not two own asked ask said say'.split(' '),
)

function primaryKind(text: string): ItemKind | null {
  if (/\brecap\b/i.test(text)) return null
  if (CUES.change.test(text)) return 'change'
  if (CUES.blocker.test(text)) return 'blocker'
  if (CUES.decision.test(text.replace(META, ''))) return 'decision'
  return null
}

function stem(w: string) {
  if (w.length > 6 && w.endsWith('ing')) return w.slice(0, -3)
  if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}

export function tokens(s: string): Set<string> {
  const words = s.toLowerCase().match(/[a-z0-9][a-z0-9'-]*[a-z0-9]/g) ?? []
  return new Set(words.filter((w) => w.length > 2 && !STOP.has(w)).map(stem))
}

function sentences(s: string) {
  return s.split(/(?<=[.!?])\s+/).filter(Boolean)
}

function clean(s: string): string {
  let t = s.trim().replace(/[.!?]+$/, '')
  let prev
  do {
    prev = t
    t = t.replace(LEAD, '')
  } while (t !== prev)
  t = t
    .replace(/^let'?s not\s+/i, "Don't ")
    .replace(/^(let'?s|we'?ll|we will|i'?d like to|we should)\s+/i, '')
    .replace(/^there'?s a blocker$/i, '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function words(s: string) {
  return s.split(/\s+/).filter(Boolean).length
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s
  return s.slice(0, s.lastIndexOf(' ', n - 1)).replace(/[,;:]$/, '') + '…'
}

function titleFor(kind: ItemKind, texts: string[]): string {
  if (kind === 'blocker') {
    for (const s of texts.flatMap(sentences)) if (words(clean(s)) >= 4) return truncate(clean(s), 64)
  } else {
    for (const text of [...texts].reverse()) {
      const cued = sentences(text)
        .filter((s) => primaryKind(s))
        .map(clean)
        .filter((s) => words(s) >= 3)
        .sort((a, b) => words(b) - words(a))
      if (cued[0]) return truncate(cued[0], 64)
    }
  }
  return truncate(clean(texts[0]), 64)
}

/** Sum of inverse document frequency for words the text shares with each corpus. */
function overlap(text: Set<string>, corpora: Set<string>[]): number[] {
  const df = new Map<string, number>()
  for (const c of corpora) for (const w of c) df.set(w, (df.get(w) ?? 0) + 1)
  return corpora.map((c) => {
    let score = 0
    for (const w of text) if (c.has(w)) score += Math.log(1 + corpora.length / df.get(w)!)
    return score
  })
}

export function extractHeuristic(ws: Workspace, meeting: Meeting): RawItem[] {
  const lines = meeting.transcript
  const tagged = lines.flatMap((l, i) => {
    const kind = primaryKind(l.text)
    return kind ? [{ i, kind }] : []
  })

  // Group cue lines that are close in both position and time.
  const clusters: { i: number; kind: ItemKind }[][] = []
  for (const x of tagged) {
    const cur = clusters.at(-1)
    const prev = cur?.at(-1)
    if (cur && prev && x.i - prev.i <= 2 && lines[x.i].t - lines[prev.i].t <= 75) cur.push(x)
    else clusters.push([x])
  }

  const meetingDate = new Map(ws.meetings.map((m) => [m.id, m.date]))
  const earlier = ws.items.filter((it) => meetingDate.get(it.meetingId)! <= meeting.date)
  const textOf = (it: TrailItem) => {
    const m = ws.meetings.find((x) => x.id === it.meetingId)!
    const ev = m.transcript.slice(it.evidence.start, it.evidence.end + 1).map((l) => l.text)
    return [it.title, it.summary, ...ev].join(' ')
  }
  const itemTokens = new Map(earlier.map((it) => [it.id, tokens(textOf(it))]))
  const threadIds = ws.threads.map((t) => t.id).filter((id) => earlier.some((it) => it.threadId === id))
  const threadTokens = threadIds.map(
    (id) => new Set(earlier.filter((it) => it.threadId === id).flatMap((it) => [...itemTokens.get(it.id)!])),
  )
  const statuses = statusesOf(ws)

  return clusters.map((cluster) => {
    const start = cluster[0].i
    const end = cluster.at(-1)!.i
    const counts = { decision: 0, blocker: 0, change: 0 }
    for (const x of cluster) counts[x.kind]++
    const kind: ItemKind = counts.change
      ? 'change'
      : counts.blocker === counts.decision
        ? cluster[0].kind
        : counts.blocker > counts.decision
          ? 'blocker'
          : 'decision'

    const texts = cluster.map((x) => lines[x.i].text)
    const own = tokens(texts.join(' '))
    // The line just before often names the topic ("Two customers asked for EU data residency…").
    const before = start > 0 && lines[start].t - lines[start - 1].t <= 60 ? lines[start - 1].text : ''
    const context = tokens(`${before} ${texts.join(' ')}`)

    // A word from the thread's own name ("Security review") is the strongest topic signal.
    const threadScores = overlap(context, threadTokens).map((score, k) => {
      const name = tokens(ws.threads.find((t) => t.id === threadIds[k])!.name)
      return score + 2 * [...name].filter((w) => context.has(w)).length
    })
    const best = threadScores.indexOf(Math.max(0, ...threadScores))
    const threadId = best >= 0 && threadScores[best] >= 2 ? threadIds[best] : undefined

    const links: { to: string; type: LinkType }[] = []
    if (threadId) {
      const inThread = earlier.filter((it) => it.threadId === threadId)
      const rank = (candidates: TrailItem[]) => {
        const scores = overlap(own, candidates.map((it) => itemTokens.get(it.id)!))
        return candidates
          .map((it, k) => ({ it, score: scores[k] + k * 0.01 })) // later items win ties
          .sort((a, b) => b.score - a.score)
      }
      const active = inThread.filter((it) => it.kind !== 'blocker' && !statuses[it.id]?.supersededBy)
      const openBlockers = inThread.filter((it) => it.kind === 'blocker' && !statuses[it.id]?.resolvedBy)
      const resolving = RESOLVED.test(lines.slice(Math.max(0, start - 2), end + 1).map((l) => l.text).join(' '))

      if (kind === 'blocker' && active.length) links.push({ to: rank(active)[0].it.id, type: 'blocks' })
      if (kind === 'change' && active.length) links.push({ to: rank(active)[0].it.id, type: 'revises' })
      if (kind === 'decision') {
        if (resolving && openBlockers.length) links.push({ to: rank(openBlockers)[0].it.id, type: 'resolves' })
        else {
          const top = rank(inThread)[0]
          if (top && top.score >= 2) links.push({ to: top.it.id, type: 'builds_on' })
        }
      }
    }

    return {
      kind,
      title: titleFor(kind, texts),
      summary: truncate(texts.join(' '), 260),
      owner: lines[start].speaker,
      thread: threadId ?? 'New topics',
      evidence: { start, end },
      links,
      confidence: Math.min(0.8, 0.55 + 0.1 * (cluster.length - 1)),
    }
  })
}
