import type { Meeting, Workspace } from '../../types'
import { formatTimestamp } from '../transcript'
import type { RawItem } from './normalize'

export const CLAUDE_MODEL = 'claude-sonnet-5-5'

const SYSTEM = `You extract the decision history from meeting transcripts for "Decision Trails", a tool that shows how a team's decisions evolve across meetings.

Find only items that matter later:
- decision: the group commits to something (a plan, a date, a design, an owner).
- blocker: something that prevents a decision or plan from going ahead.
- change: a new decision that replaces or reverses an earlier one.
Ignore small talk, status updates, and to-dos that are not decisions.

For each item:
- thread: the ID of an existing thread on the same topic, or a short new thread name (2-3 words, Title Case).
- links: relations from this NEW item to EARLIER items, by their IDs from the list. Types: "revises" (replaces it), "blocks" (prevents it), "resolves" (clears that blocker), "builds_on" (continues it). Link only when the transcript supports it.
- title: at most 8 words, outcome style, such as "GA moves to Nov 3".
- summary: 1-2 sentences with the concrete specifics (numbers, names, dates, reasons).
- owner: the person accountable, by name as in the transcript.
- evidence: the first and last transcript line numbers (the L numbers) that support the item.
- confidence: 0 to 1.

Reply with JSON only, no prose and no code fence:
{"items":[{"kind":"decision","title":"","summary":"","owner":"","thread":"","evidence":{"start":0,"end":0},"links":[{"to":"","type":"builds_on"}],"confidence":0.9}]}`

function prompt(ws: Workspace, meeting: Meeting): string {
  const date = (iso: string) => iso.slice(0, 10)
  const meetingOf = (id: string) => ws.meetings.find((m) => m.id === id)!
  const threads = ws.threads.map((t) => `- ${t.id}: ${t.name}`).join('\n') || '(none yet)'
  const items =
    ws.items
      .map((it) => {
        const m = meetingOf(it.meetingId)
        return `- [${it.id}] ${it.kind} in thread ${it.threadId}, "${m.title}" ${date(m.date)}: ${it.title}. ${it.summary}`
      })
      .join('\n') || '(none yet)'
  const transcript = meeting.transcript
    .map((l, i) => `L${i} [${formatTimestamp(l.t)}] ${l.speaker}: ${l.text}`)
    .join('\n')
  return `Existing threads:\n${threads}\n\nItems from earlier meetings:\n${items}\n\nNew meeting: "${meeting.title}" on ${date(meeting.date)}\n\nTranscript:\n${transcript}`
}

/** Calls the Claude API from the browser with the user's own key (bring your own key). */
export async function extractWithClaude(apiKey: string, ws: Workspace, meeting: Meeting): Promise<RawItem[]> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt(ws, meeting) }],
    }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const message = body?.error?.message ?? `HTTP ${res.status}`
    if (res.status === 401) throw new Error(`Claude rejected the API key. ${message}`)
    throw new Error(`Claude request failed: ${message}`)
  }
  const text: string = (body?.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('')
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  try {
    const items = JSON.parse(json).items
    if (!Array.isArray(items)) throw new Error('no items')
    return items
  } catch {
    throw new Error('Claude replied, but not with the expected JSON. Try again.')
  }
}
