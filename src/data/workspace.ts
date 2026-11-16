import type { ItemKind, LinkType, Meeting, Person, Thread, TrailItem, Workspace } from '../types'
import { parseTimestamp, parseTranscript, speakersOf } from '../lib/transcript'
import { goNoGo, kickoff, readinessReview, weeklySync } from './transcripts'

export const people: Record<string, Person> = {
  'Maya Chen': { name: 'Maya Chen', role: 'Product lead' },
  'Daniel Okafor': { name: 'Daniel Okafor', role: 'Engineering manager' },
  'Leo Martins': { name: 'Leo Martins', role: 'Data engineer' },
  'Priya Raman': { name: 'Priya Raman', role: 'Product designer' },
  'Sofia Alvarez': { name: 'Sofia Alvarez', role: 'Product marketing' },
  'Hannah Kim': { name: 'Hannah Kim', role: 'Security & compliance' },
  'Marcus Bell': { name: 'Marcus Bell', role: 'Enterprise sales' },
}

function meeting(id: string, title: string, date: string, durationMin: number, text: string): Meeting {
  const transcript = parseTranscript(text)
  return { id, title, date, durationMin, transcript, attendees: speakersOf(transcript), engine: 'sample' }
}

const meetings: Meeting[] = [
  meeting('m1', 'Pulse kickoff', '2026-09-01T10:00:00', 45, kickoff),
  meeting('m2', 'Pulse weekly sync', '2026-09-17T09:30:00', 30, weeklySync),
  meeting('m3', 'Launch readiness review', '2026-09-24T14:00:00', 50, readinessReview),
  meeting('m4', 'Go / no-go', '2026-10-27T11:00:00', 35, goNoGo),
]

export const threads: Thread[] = [
  { id: 'launch', name: 'Launch date' },
  { id: 'security', name: 'Security review' },
  { id: 'architecture', name: 'Data architecture' },
  { id: 'pricing', name: 'Pricing & packaging' },
  { id: 'onboarding', name: 'Onboarding' },
]

interface Def {
  id: string
  meeting: string
  thread: string
  kind: ItemKind
  title: string
  summary: string
  owner: string
  /** First and last supporting timestamps, as written in the transcript. */
  at: [string, string]
  links?: [string, LinkType][]
  confidence: number
}

const defs: Def[] = [
  // Kickoff, Sep 1
  {
    id: 'ga-oct14', meeting: 'm1', thread: 'launch', kind: 'decision', owner: 'Maya Chen', confidence: 0.97,
    title: 'Pulse goes GA on Oct 14 at Summit',
    summary: 'The team committed to general availability on October 14, announced at the Kestrel Summit livestream. Engineering planned five weeks of build and one week of hardening.',
    at: ['03:52', '04:39'],
  },
  {
    id: 'beta', meeting: 'm1', thread: 'launch', kind: 'decision', owner: 'Sofia Alvarez', confidence: 0.93,
    title: 'Private beta with five design partners',
    summary: 'A two-week private beta starts September 28, so real customers use Pulse before Summit. Brightwave must be one of the partners.',
    at: ['05:02', '05:29'], links: [['ga-oct14', 'builds_on']],
  },
  {
    id: 'matviews', meeting: 'm1', thread: 'architecture', kind: 'decision', owner: 'Leo Martins', confidence: 0.96,
    title: 'Postgres materialized views for v1',
    summary: 'Aggregate on materialized views over the events table, refreshed every 15 minutes. No new infrastructure or vendor. The team agreed to revisit it if they hit limits.',
    at: ['10:02', '11:02'],
  },
  {
    id: 'pro-included', meeting: 'm1', thread: 'pricing', kind: 'decision', owner: 'Sofia Alvarez', confidence: 0.95,
    title: 'Pulse included in Pro at no extra cost',
    summary: 'Sofia framed Pulse as a retention play that makes Pro more valuable and gives sales a reason to upgrade Starter accounts.',
    at: ['18:31', '19:06'],
  },
  {
    id: 'builder', meeting: 'm1', thread: 'onboarding', kind: 'decision', owner: 'Priya Raman', confidence: 0.94,
    title: 'Launch with the custom dashboard builder',
    summary: 'The drag-and-drop builder was chosen as the hero moment for launch, although it is the largest piece of front-end work.',
    at: ['26:52', '27:36'],
  },

  // Weekly sync, Sep 17
  {
    id: 'refresh', meeting: 'm2', thread: 'architecture', kind: 'blocker', owner: 'Leo Martins', confidence: 0.97,
    title: 'Refresh takes 38 min for large tenants',
    summary: "A load test on Brightwave's data showed a 38-minute refresh against a 15-minute window. Eleven tenants over 10M events, the biggest accounts, would always see stale data.",
    at: ['00:20', '01:15'], links: [['matviews', 'blocks']],
  },
  {
    id: 'spike', meeting: 'm2', thread: 'architecture', kind: 'decision', owner: 'Leo Martins', confidence: 0.9,
    title: 'Spike ClickHouse before deciding',
    summary: 'Instead of deciding on a hunch, Leo tests ClickHouse on the same Brightwave dataset. The architecture call moves to the readiness review on Sep 24.',
    at: ['01:24', '02:01'], links: [['refresh', 'builds_on']],
  },
  {
    id: 'vendor', meeting: 'm2', thread: 'security', kind: 'blocker', owner: 'Hannah Kim', confidence: 0.95,
    title: 'A new data vendor needs a SOC 2 review',
    summary: 'Any new vendor that stores customer data triggers a three-to-four-week SOC 2 vendor review. Hannah flagged it as a blocker on the October 14 date.',
    at: ['02:30', '03:27'], links: [['ga-oct14', 'blocks']],
  },
  {
    id: 'templates', meeting: 'm2', thread: 'onboarding', kind: 'change', owner: 'Priya Raman', confidence: 0.96,
    title: 'Starter templates replace the builder',
    summary: 'Four of six design partners stalled on the empty builder canvas. Launch now ships three templates (Adoption, Engagement, Workflow health), and the builder moves to v1.1, saving about two weeks.',
    at: ['08:52', '10:01'], links: [['builder', 'revises']],
  },

  // Readiness review, Sep 24
  {
    id: 'hybrid', meeting: 'm3', thread: 'architecture', kind: 'change', owner: 'Leo Martins', confidence: 0.97,
    title: 'Hybrid store: ClickHouse for 10M+ tenants',
    summary: 'The spike cut a full aggregation from 38 minutes to about 4 seconds. Large tenants route to ClickHouse and the other ~400 stay on Postgres, which limits the blast radius.',
    at: ['00:30', '01:35'], links: [['matviews', 'revises'], ['refresh', 'resolves'], ['spike', 'builds_on']],
  },
  {
    id: 'ga-nov3', meeting: 'm3', thread: 'launch', kind: 'change', owner: 'Maya Chen', confidence: 0.98,
    title: 'GA moves to Nov 3, Summit becomes a preview',
    summary: 'The vendor review cannot finish before Oct 23, so Oct 14 is no longer possible. Pulse is previewed at Summit and goes GA on November 3, after one week of buffer.',
    at: ['01:58', '02:46'], links: [['ga-oct14', 'revises']],
  },
  {
    id: 'review-start', meeting: 'm3', thread: 'security', kind: 'decision', owner: 'Hannah Kim', confidence: 0.91,
    title: 'Start the ClickHouse vendor review today',
    summary: 'Hannah owns the SOC 2 vendor review and sends the security questionnaire to ClickHouse the same day.',
    at: ['02:57', '03:06'], links: [['vendor', 'builds_on']],
  },
  {
    id: 'addon', meeting: 'm3', thread: 'pricing', kind: 'change', owner: 'Marcus Bell', confidence: 0.96,
    title: 'Advanced Pulse becomes an $8 add-on',
    summary: 'Three enterprise prospects expected to pay for Pulse. Core Pulse with templates stays in Pro. The ClickHouse tier, exports and longer history become an $8 per seat Enterprise add-on.',
    at: ['14:16', '15:20'], links: [['pro-included', 'revises']],
  },

  // Go / no-go, Oct 27
  {
    id: 'review-approved', meeting: 'm4', thread: 'security', kind: 'decision', owner: 'Hannah Kim', confidence: 0.97,
    title: 'SOC 2 review approved: security is a go',
    summary: "The ClickHouse Cloud vendor review was approved, and the report went to Brightwave's procurement team.",
    at: ['00:16', '00:36'], links: [['vendor', 'resolves'], ['review-start', 'builds_on']],
  },
  {
    id: 'ship-hybrid', meeting: 'm4', thread: 'architecture', kind: 'decision', owner: 'Daniel Okafor', confidence: 0.94,
    title: 'Ship the hybrid store as tested',
    summary: 'All 11 large tenants run on the hybrid store in staging at 820 ms p95 (target: 900 ms), with failover to a cached snapshot. The 10M-event threshold stays.',
    at: ['00:52', '01:24'], links: [['hybrid', 'builds_on']],
  },
  {
    id: 'billing', meeting: 'm4', thread: 'pricing', kind: 'blocker', owner: 'Daniel Okafor', confidence: 0.95,
    title: "Billing can't meter add-on seats yet",
    summary: 'The billing update lands mid-November, so the add-on cannot be charged on Nov 3. It blocks the add-on, not the launch. Daniel confirms the date with finance by Friday.',
    at: ['04:44', '05:16'], links: [['addon', 'blocks']],
  },
  {
    id: 'request-button', meeting: 'm4', thread: 'onboarding', kind: 'decision', owner: 'Priya Raman', confidence: 0.92,
    title: 'Add a "Request a custom dashboard" button',
    summary: 'Seven of eight beta partners built a first dashboard in under two minutes. A request button inside the templates collects demand data for the v1.1 builder.',
    at: ['09:35', '10:02'], links: [['templates', 'builds_on']],
  },
  {
    id: 'go', meeting: 'm4', thread: 'launch', kind: 'decision', owner: 'Maya Chen', confidence: 0.98,
    title: 'Go: launch Nov 3 with a staged rollout',
    summary: 'Every function is a go. Pulse launches to 10% of accounts on November 3 and to everyone by November 10.',
    at: ['31:05', '31:35'], links: [['ga-nov3', 'builds_on']],
  },
]

function lineAt(m: Meeting, stamp: string): number {
  const t = parseTimestamp(stamp)
  const index = m.transcript.findIndex((line) => line.t === t)
  if (index < 0) throw new Error(`No line at ${stamp} in ${m.id}`)
  return index
}

const items: TrailItem[] = defs.map((d) => {
  const m = meetings.find((x) => x.id === d.meeting)
  if (!m) throw new Error(`Unknown meeting ${d.meeting}`)
  return {
    id: d.id,
    meetingId: d.meeting,
    threadId: d.thread,
    kind: d.kind,
    title: d.title,
    summary: d.summary,
    owner: d.owner,
    evidence: { start: lineAt(m, d.at[0]), end: lineAt(m, d.at[1]) },
    links: (d.links ?? []).map(([to, type]) => ({ to, type })),
    confidence: d.confidence,
  }
})

export const sampleWorkspace: Workspace = { people, meetings, threads, items }
