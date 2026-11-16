import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { ArrowRight, Clock, Cpu, FileText, Quote, Sparkles, X } from 'lucide-react'
import type { Meeting, TrailItem, Workspace } from './types'
import { chronological, statusLabel, trailOf, type ItemStatus } from './lib/graph'
import { formatTimestamp } from './lib/transcript'
import { Avatar, KIND, KindBadge, LINK, StatusChip, fmtDate } from './ui'

export type Selection =
  | { type: 'item'; id: string }
  | { type: 'meeting'; id: string; focus?: { start: number; end: number; itemId: string } }

interface Props {
  ws: Workspace
  statuses: Record<string, ItemStatus>
  selection: Selection
  onSelect: (s: Selection) => void
  onClose: () => void
}

export function Panel(p: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (p.selection.type === 'item' || !p.selection.focus) scroller.current?.scrollTo({ top: 0 })
  }, [p.selection])

  return (
    <motion.aside
      initial={{ x: 32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 32, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      className="absolute bottom-3 right-3 top-3 z-40 flex w-[440px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_60px_-20px_rgba(29,42,48,0.35)]"
    >
      <button
        onClick={p.onClose}
        aria-label="Close"
        className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-paper hover:text-ink"
      >
        <X className="size-4" />
      </button>
      <div ref={scroller} className="thin-scroll flex-1 overflow-y-auto">
        {p.selection.type === 'item' ? (
          <ItemView {...p} id={p.selection.id} />
        ) : (
          <MeetingView {...p} id={p.selection.id} focus={p.selection.focus} />
        )}
      </div>
    </motion.aside>
  )
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="border-t border-line/70 px-6 py-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}

function EngineNote({ meeting, confidence }: { meeting: Meeting; confidence: number }) {
  const pct = `${Math.round(confidence * 100)}% confidence`
  if (meeting.engine === 'claude')
    return (
      <span className="inline-flex items-center gap-1 text-violet">
        <Sparkles className="size-3.5" /> Extracted by Claude · {pct}
      </span>
    )
  if (meeting.engine === 'on-device')
    return (
      <span className="inline-flex items-center gap-1">
        <Cpu className="size-3.5" /> On-device extraction · {pct}
      </span>
    )
  return <span>Pre-analyzed sample · {pct}</span>
}

function ItemView({ ws, statuses, id, onSelect }: Props & { id: string }) {
  const item = ws.items.find((it) => it.id === id)
  if (!item) return null
  const meeting = ws.meetings.find((m) => m.id === item.meetingId)!
  const status = statusLabel(item, statuses[item.id])
  const byId = new Map(ws.items.map((it) => [it.id, it]))
  const k = KIND[item.kind]

  const outgoing = item.links.filter((l) => byId.has(l.to)).map((l) => ({ type: l.type, other: byId.get(l.to)!, dir: 'out' as const }))
  const incoming = ws.items.flatMap((it) =>
    it.links.filter((l) => l.to === item.id).map((l) => ({ type: l.type, other: it, dir: 'in' as const })),
  )
  const connections = chronological(ws, [...outgoing, ...incoming].map((c) => c.other)).map(
    (other) => [...outgoing, ...incoming].find((c) => c.other === other)!,
  )
  const trail = chronological(ws, [...trailOf(ws, item.id)].map((tid) => byId.get(tid)!))

  const from = Math.max(0, item.evidence.start - 1)
  const to = Math.min(meeting.transcript.length - 1, item.evidence.end + 1)
  const startT = meeting.transcript[item.evidence.start]?.t ?? 0
  const endT = meeting.transcript[item.evidence.end]?.t ?? startT
  const owner = item.owner ? ws.people[item.owner] : undefined

  return (
    <motion.div key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
      <div className="px-6 pb-5 pt-5">
        <div className="flex items-center gap-2 pr-8">
          <KindBadge kind={item.kind} size="md" />
          <StatusChip status={status} />
        </div>
        <h2 className={`mt-3 font-serif text-[24px] font-semibold leading-[1.2] ${status === 'superseded' ? 'text-ink-2' : ''}`}>{item.title}</h2>
        {item.summary && <p className="mt-2.5 text-[14px] leading-relaxed text-ink-2">{item.summary}</p>}

        <dl className="mt-5 grid grid-cols-[88px_1fr] gap-x-3 gap-y-2.5 text-[13px]">
          <dt className="text-ink-3">Meeting</dt>
          <dd>
            <button onClick={() => onSelect({ type: 'meeting', id: meeting.id })} className="text-left font-medium hover:underline">
              {meeting.title}
            </button>
            <span className="text-ink-3"> · {fmtDate(meeting.date)}</span>
          </dd>
          {item.owner && (
            <>
              <dt className="text-ink-3">Owner</dt>
              <dd className="flex items-center gap-2">
                <Avatar name={item.owner} size={20} />
                <span className="font-medium">{item.owner}</span>
                {owner?.role && <span className="text-ink-3">{owner.role}</span>}
              </dd>
            </>
          )}
          <dt className="text-ink-3">Source</dt>
          <dd className="text-ink-2">
            <EngineNote meeting={meeting} confidence={item.confidence} />
          </dd>
        </dl>
      </div>

      <Section
        title="From the transcript"
        right={
          <span className="inline-flex items-center gap-1 rounded-md bg-paper px-1.5 py-0.5 text-[11.5px] font-medium tabular-nums text-ink-2">
            <Clock className="size-3" />
            {formatTimestamp(startT)}
            {endT !== startT && `–${formatTimestamp(endT)}`}
          </span>
        }
      >
        <div className="relative overflow-hidden rounded-xl border border-line bg-paper/60">
          <Quote className="absolute right-3 top-3 size-5 text-ink/[0.07]" />
          <div className="py-1.5">
            {meeting.transcript.slice(from, to + 1).map((line, i) => {
              const index = from + i
              const inside = index >= item.evidence.start && index <= item.evidence.end
              return (
                <div
                  key={index}
                  className={`relative px-4 py-1.5 text-[13px] leading-relaxed ${inside ? '' : 'text-ink-3'}`}
                  style={inside ? { background: `color-mix(in srgb, ${k.soft} 70%, transparent)` } : undefined}
                >
                  {inside && <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: k.color }} />}
                  <span className="mr-2 text-[11px] tabular-nums text-ink-3">{formatTimestamp(line.t)}</span>
                  <span className={`font-semibold ${inside ? 'text-ink' : ''}`}>{line.speaker}</span>
                  <span className={inside ? 'text-ink-2' : ''}> {line.text}</span>
                </div>
              )
            })}
          </div>
        </div>
        <button
          onClick={() =>
            onSelect({ type: 'meeting', id: meeting.id, focus: { ...item.evidence, itemId: item.id } })
          }
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-decision hover:underline"
        >
          <FileText className="size-3.5" /> Open in full transcript <ArrowRight className="size-3.5" />
        </button>
      </Section>

      {connections.length > 0 && (
        <Section title="Connections">
          <div className="space-y-1">
            {connections.map(({ type, other, dir }) => (
              <ConnectionRow
                key={`${dir}-${other.id}`}
                label={dir === 'out' ? LINK[type].out : LINK[type].in}
                color={LINK[type].color}
                item={other}
                ws={ws}
                onClick={() => onSelect({ type: 'item', id: other.id })}
              />
            ))}
          </div>
        </Section>
      )}

      {trail.length > 1 && (
        <Section title="How this evolved">
          <ol className="relative">
            <span className="absolute bottom-3 left-[7px] top-3 w-px bg-line" />
            {trail.map((t) => {
              const m = ws.meetings.find((x) => x.id === t.meetingId)!
              const st = statusLabel(t, statuses[t.id])
              const current = t.id === item.id
              return (
                <li key={t.id}>
                  <button
                    onClick={() => onSelect({ type: 'item', id: t.id })}
                    className={`relative flex w-full items-start gap-3 rounded-lg py-1.5 pl-0 pr-2 text-left transition-colors ${current ? '' : 'hover:bg-paper'}`}
                  >
                    <span
                      className={`relative z-10 mt-[3px] size-[15px] shrink-0 rounded-full border-[3px] border-white ${current ? 'ring-2 ring-ink/70' : ''}`}
                      style={{ background: KIND[t.kind].color, opacity: st === 'superseded' || st === 'resolved' ? 0.45 : 1 }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11.5px] text-ink-3">
                        {fmtDate(m.date, { month: 'short', day: 'numeric' })} · {m.title}
                      </span>
                      <span className={`block text-[13px] leading-snug ${current ? 'font-semibold text-ink' : st === 'superseded' ? 'text-ink-3 line-through decoration-ink/20' : 'text-ink-2'}`}>
                        {t.title}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </Section>
      )}
    </motion.div>
  )
}

function ConnectionRow({ label, color, item, ws, onClick }: { label: string; color: string; item: TrailItem; ws: Workspace; onClick: () => void }) {
  const m = ws.meetings.find((x) => x.id === item.meetingId)!
  return (
    <button onClick={onClick} className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-paper">
      <span className="w-[76px] shrink-0 text-[11.5px] font-semibold" style={{ color }}>
        {label}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">{item.title}</span>
        <span className="block text-[11.5px] text-ink-3">
          {KIND[item.kind].label} · {m.title}, {fmtDate(m.date, { month: 'short', day: 'numeric' })}
        </span>
      </span>
      <ArrowRight className="size-3.5 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

function MeetingView({ ws, id, focus, onSelect }: Props & { id: string; focus?: { start: number; end: number; itemId: string } }) {
  const meeting = ws.meetings.find((m) => m.id === id)
  const focusRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focus])
  if (!meeting) return null
  const items = ws.items.filter((it) => it.meetingId === id).sort((a, b) => a.evidence.start - b.evidence.start)
  const itemAt = (i: number) => items.find((it) => i >= it.evidence.start && i <= it.evidence.end)

  return (
    <motion.div key={id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
      <div className="px-6 pb-5 pt-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-decision">
          {fmtDate(meeting.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        <h2 className="mt-1.5 pr-8 font-serif text-[24px] font-semibold leading-tight">{meeting.title}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px] text-ink-2">
          <span>{meeting.durationMin} min</span>
          <span className="text-ink-3">·</span>
          <span>{meeting.transcript.length} transcript lines</span>
        </div>
        {meeting.engine !== 'sample' && (
          <div className="mt-1.5 text-[12.5px] text-ink-2">
            <EngineNote meeting={meeting} confidence={items.length ? items.reduce((s, it) => s + it.confidence, 0) / items.length : 0} />
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {meeting.attendees.map((name) => (
            <span key={name} className="inline-flex items-center gap-1.5 rounded-full bg-paper py-0.5 pl-0.5 pr-2 text-[12px] text-ink-2">
              <Avatar name={name} size={18} />
              {name}
            </span>
          ))}
        </div>
      </div>

      <Section title={`Found in this meeting · ${items.length}`}>
        {items.length === 0 && <p className="text-[13px] text-ink-3">No decisions, blockers, or changes were found.</p>}
        <div className="space-y-1">
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => onSelect({ type: 'item', id: it.id })}
              className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-paper"
            >
              <KindBadge kind={it.kind} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{it.title}</span>
              <span className="text-[11px] tabular-nums text-ink-3">{formatTimestamp(meeting.transcript[it.evidence.start]?.t ?? 0)}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Transcript">
        <div className="-mx-2">
          {meeting.transcript.map((line, i) => {
            const it = itemAt(i)
            const focused = !!focus && i >= focus.start && i <= focus.end
            const k = it ? KIND[it.kind] : null
            return (
              <div
                key={i}
                ref={focus && i === focus.start ? focusRef : undefined}
                onClick={it ? () => onSelect({ type: 'item', id: it.id }) : undefined}
                className={`relative rounded-md px-3 py-1.5 text-[13px] leading-relaxed transition-colors ${it ? 'cursor-pointer hover:bg-paper' : ''}`}
                style={focused && k ? { background: k.soft } : undefined}
              >
                {k && <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full" style={{ background: k.color, opacity: focused ? 1 : 0.55 }} />}
                <span className="mr-2 text-[11px] tabular-nums text-ink-3">{formatTimestamp(line.t)}</span>
                <span className="font-semibold">{line.speaker}</span>
                <span className="text-ink-2"> {line.text}</span>
              </div>
            )
          })}
        </div>
      </Section>
    </motion.div>
  )
}
