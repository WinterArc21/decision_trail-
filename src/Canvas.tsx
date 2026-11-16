import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { Cpu, Sparkles } from 'lucide-react'
import type { ItemKind, TrailItem, Workspace } from './types'
import { L, edgePath, statusLabel, threadNow, type Edge, type ItemStatus, type Layout } from './lib/graph'
import { formatTimestamp } from './lib/transcript'
import { Avatar, AvatarStack, KIND, KindBadge, LINK, StatusChip, fmtDate } from './ui'

interface Props {
  ws: Workspace
  layout: Layout
  statuses: Record<string, ItemStatus>
  edges: Edge[]
  /** Items to emphasize; everything else dims. */
  focus: Set<string> | null
  selectedId: string | null
  selectedMeetingId: string | null
  filter: 'all' | ItemKind
  fresh: Set<string>
  scrollTo: { meetingId: string; key: number } | null
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
  onSelectMeeting: (id: string) => void
  onBackground: () => void
}

export function Canvas(p: Props) {
  const { ws, layout, statuses } = p
  const scroller = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null)
  const meetingIndex = new Map(layout.columns.map((c, i) => [c.meeting.id, i]))

  useEffect(() => {
    const col = layout.columns.find((c) => c.meeting.id === p.scrollTo?.meetingId)
    const el = scroller.current
    if (col && el) el.scrollTo({ left: Math.max(0, col.x + L.colW + L.endPad - el.clientWidth), behavior: 'smooth' })
  }, [p.scrollTo, layout.columns])

  // Drag the background to pan.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, a, input, textarea')) return
    const el = scroller.current!
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) > 4) {
      d.moved = true
      scroller.current!.setPointerCapture(e.pointerId)
    }
    if (d.moved) {
      scroller.current!.scrollLeft = d.left - dx
      scroller.current!.scrollTop = d.top - dy
    }
  }
  const onPointerUp = () => {
    if (drag.current && !drag.current.moved) p.onBackground()
    drag.current = null
  }

  const totals = {
    revised: Object.values(statuses).filter((s) => s.supersededBy).length,
    open: ws.items.filter((it) => it.kind === 'blocker' && !statuses[it.id]?.resolvedBy).length,
  }

  return (
    <div
      ref={scroller}
      className="thin-scroll canvas-bg absolute inset-0 cursor-grab overflow-auto active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
    >
      <div className="relative mx-auto pb-28" style={{ width: layout.width, minHeight: '100%' }}>
        {/* Meeting headers */}
        <div className="sticky top-0 z-30 border-b border-line/80 bg-paper/85 backdrop-blur-md" style={{ height: L.headerH }}>
          <div className="sticky left-0 z-10 flex h-full flex-col justify-center bg-paper pl-7 pr-3" style={{ width: L.laneLabelW }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">Kestrel · Project</div>
            <div className="font-serif text-[21px] font-semibold leading-tight">Pulse launch</div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
              <span className="rounded-full bg-change/10 px-2 py-0.5 font-medium text-change">{totals.revised} revised</span>
              {totals.open > 0 && (
                <span className="rounded-full bg-blocker/10 px-2 py-0.5 font-medium text-blocker">{totals.open} open blocker{totals.open > 1 ? 's' : ''}</span>
              )}
            </div>
          </div>

          {/* The time axis that joins the meetings */}
          {layout.columns.length > 1 && (
            <div
              className="absolute h-px bg-gradient-to-r from-ink/10 via-ink/20 to-ink/10"
              style={{ left: layout.columns[0].center, width: layout.columns.at(-1)!.center - layout.columns[0].center, bottom: 18 }}
            />
          )}
          {layout.columns.map((c, i) => {
            const m = c.meeting
            const active = p.selectedMeetingId === m.id
            return (
              <motion.button
                key={m.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.08 }}
                onClick={() => p.onSelectMeeting(m.id)}
                className="group absolute top-0 flex h-full flex-col items-center justify-start pt-4 text-center"
                style={{ left: c.x, width: L.colW }}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-decision">
                  {fmtDate(m.date, { weekday: 'short' })} · {fmtDate(m.date, { month: 'short', day: 'numeric' })}
                  {m.engine === 'claude' && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-violet/10 px-1.5 py-px normal-case tracking-normal text-violet">
                      <Sparkles className="size-3" /> Claude
                    </span>
                  )}
                  {m.engine === 'on-device' && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-ink/[0.06] px-1.5 py-px normal-case tracking-normal text-ink-2">
                      <Cpu className="size-3" /> On-device
                    </span>
                  )}
                </div>
                <div
                  className={`mt-1 max-w-[260px] truncate rounded-md px-2 font-serif text-[17px] font-semibold leading-snug transition-colors ${active ? 'bg-ink text-white' : 'group-hover:bg-ink/[0.05]'}`}
                >
                  {m.title}
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-ink-3">
                  <AvatarStack names={m.attendees} size={22} />
                  <span>{m.durationMin} min</span>
                </div>
                <span
                  className={`absolute bottom-[14px] size-[9px] rounded-full border-2 border-paper transition-transform ${active ? 'scale-125 bg-ink' : 'bg-ink/40 group-hover:scale-125'}`}
                />
              </motion.button>
            )
          })}
        </div>

        {/* Lanes */}
        <div className="relative" style={{ height: layout.bodyH }}>
          <div className="sticky left-0 z-20 h-full" style={{ width: L.laneLabelW }}>
            <div className="absolute inset-0 bg-gradient-to-r from-paper from-80% to-paper/0" />
            {layout.lanes.map((lane) => {
              const { current, openBlockers } = threadNow(ws, statuses, lane.thread.id)
              return (
                <div key={lane.thread.id} className="absolute left-0 right-0 pl-7 pr-6" style={{ top: lane.y + L.lanePad - 2, height: lane.h }}>
                  <div className="text-[13.5px] font-semibold text-ink">{lane.thread.name}</div>
                  {current && (
                    <button onClick={() => p.onSelect(current.id)} className="mt-2 block text-left">
                      <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Where it stands</div>
                      <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-2 hover:text-ink">{current.title}</div>
                    </button>
                  )}
                  {openBlockers.length > 0 && (
                    <button
                      onClick={() => p.onSelect(openBlockers[0].id)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blocker/10 px-2 py-0.5 text-[11px] font-semibold text-blocker"
                    >
                      <span className="size-1.5 animate-pulse rounded-full bg-blocker" />
                      {openBlockers.length} open blocker{openBlockers.length > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {layout.lanes.map((lane, i) => (
            <div
              key={lane.thread.id}
              className={`absolute left-0 right-0 border-b border-line/70 ${i % 2 ? 'bg-white/25' : ''}`}
              style={{ top: lane.y, height: lane.h }}
            />
          ))}
          {layout.columns.slice(1).map((c) => (
            <div key={c.meeting.id} className="absolute top-0 bottom-0 border-l border-dashed border-ink/[0.07]" style={{ left: c.x }} />
          ))}

          <Edges {...p} />

          {ws.items.map((it) => (
            <Card
              key={it.id}
              item={it}
              {...p}
              delay={0.25 + (meetingIndex.get(it.meetingId) ?? 0) * 0.14 + (layout.pos[it.id]?.lane ?? 0) * 0.03}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Edges({ layout, edges, focus, ws }: Props) {
  const col = new Map(layout.columns.map((c, i) => [c.meeting.id, i]))
  const items = new Map(ws.items.map((it) => [it.id, it]))
  const paths = edges.flatMap((e) => {
    const a = layout.pos[e.from]
    const b = layout.pos[e.to]
    if (!a || !b) return []
    const on = !!focus && focus.has(e.from) && focus.has(e.to)
    const delay = 0.5 + (col.get(items.get(e.to)!.meetingId) ?? 0) * 0.14
    return [{ e, ...edgePath(a, b), on, dim: !!focus && !on, delay, same: a.col === b.col }]
  })

  return (
    <>
      <svg className="pointer-events-none absolute inset-0 z-0 overflow-visible" width={layout.width} height={layout.bodyH}>
        <defs>
          {Object.entries(LINK).map(([type, l]) => (
            <marker key={type} id={`arrow-${type}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" fill={l.color} />
            </marker>
          ))}
        </defs>
        {paths.map(({ e, d, on, dim, delay }) => (
          <g key={e.id}>
            <motion.path
              d={d}
              fill="none"
              stroke={LINK[e.type].color}
              strokeLinecap="round"
              markerEnd={`url(#arrow-${e.type})`}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: dim ? 0.12 : on ? 1 : 0.55, strokeWidth: on ? 2.4 : 1.6 }}
              transition={{ pathLength: { duration: 0.9, delay, ease: 'easeInOut' }, opacity: { duration: 0.25 }, strokeWidth: { duration: 0.2 } }}
            />
            {on && <path d={d} fill="none" stroke="white" strokeOpacity={0.85} strokeWidth={1.4} strokeDasharray="2 8" className="edge-flow" />}
          </g>
        ))}
      </svg>
      {paths
        .filter((x) => x.on && !x.same)
        .map(({ e, mid }) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="pointer-events-none absolute z-[5] -translate-x-1/2 -translate-y-1/2 rounded-full border bg-white px-1.5 py-px text-[10.5px] font-semibold shadow-sm"
            style={{ left: mid.x, top: mid.y, color: LINK[e.type].color, borderColor: `color-mix(in srgb, ${LINK[e.type].color} 30%, white)` }}
          >
            {LINK[e.type].label}
          </motion.div>
        ))}
    </>
  )
}

function Card({ item, delay, ...p }: Props & { item: TrailItem; delay: number }) {
  const pos = p.layout.pos[item.id]
  if (!pos) return null

  const meeting = p.ws.meetings.find((m) => m.id === item.meetingId)!
  const status = statusLabel(item, p.statuses[item.id])
  const k = KIND[item.kind]
  const selected = p.selectedId === item.id
  const fresh = p.fresh.has(item.id)
  const filteredOut = p.filter !== 'all' && p.filter !== item.kind
  const dim = filteredOut || (!!p.focus && !p.focus.has(item.id))
  const muted = status === 'superseded' || status === 'resolved'

  return (
    <motion.div
      className="absolute z-10"
      style={{ width: L.cardW, height: L.cardH }}
      initial={{ opacity: 0, scale: 0.94, y: 10, left: pos.x, top: pos.y }}
      animate={{ opacity: 1, scale: 1, y: 0, left: pos.x, top: pos.y }}
      transition={{
        default: { type: 'spring', stiffness: 320, damping: 30, delay },
        left: { type: 'spring', stiffness: 260, damping: 32 },
        top: { type: 'spring', stiffness: 260, damping: 32 },
      }}
    >
      <button
        data-node
        onMouseEnter={() => p.onHover(item.id)}
        onMouseLeave={() => p.onHover(null)}
        onFocus={() => p.onHover(item.id)}
        onBlur={() => p.onHover(null)}
        onClick={() => p.onSelect(item.id)}
        className={`group relative flex h-full w-full cursor-pointer flex-col rounded-[14px] border bg-white py-2.5 pl-4 pr-3 text-left outline-none transition-[opacity,box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-decision/50 ${
          selected
            ? 'border-ink/70 shadow-[0_0_0_3px_rgba(29,42,48,0.12),0_10px_30px_-12px_rgba(29,42,48,0.35)]'
            : 'border-line shadow-[0_1px_2px_rgba(29,42,48,0.05),0_6px_18px_-12px_rgba(29,42,48,0.25)] hover:border-ink/25 hover:shadow-[0_1px_2px_rgba(29,42,48,0.06),0_14px_30px_-14px_rgba(29,42,48,0.4)]'
        } ${muted ? 'bg-white/70' : ''}`}
        style={{ opacity: dim ? 0.28 : 1 }}
      >
        <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full" style={{ background: k.color, opacity: muted ? 0.35 : 1 }} />
        <div className="flex items-center justify-between gap-2">
          <KindBadge kind={item.kind} />
          <span className="text-[11px] tabular-nums text-ink-3">{formatTimestamp(meeting.transcript[item.evidence.start]?.t ?? 0)}</span>
        </div>
        <div className={`mt-1.5 line-clamp-2 text-[13.5px] font-semibold leading-[1.3] ${muted ? 'text-ink-3' : 'text-ink'}`}>{item.title}</div>
        <div className="mt-auto flex items-center gap-1.5 text-[11.5px] text-ink-2">
          {item.owner && (
            <>
              <Avatar name={item.owner} size={17} />
              <span className="truncate">{item.owner.split(' ')[0]}</span>
            </>
          )}
          <span className="ml-auto flex items-center gap-1">
            {fresh && <span className="rounded-full bg-violet/10 px-1.5 py-px text-[10.5px] font-semibold text-violet">New</span>}
            <StatusChip status={status} />
          </span>
        </div>
        {fresh && (
          <motion.span
            className="pointer-events-none absolute -inset-px rounded-[14px] border-2 border-violet"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.2, 1, 0] }}
            transition={{ duration: 2.4, delay: delay + 0.4 }}
          />
        )}
      </button>
    </motion.div>
  )
}
