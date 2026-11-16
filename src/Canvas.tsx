import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import type { ItemKind, TrailItem, Workspace } from './types'
import { L, edgePath, statusLabel, threadNow, type Edge, type ItemStatus, type Layout } from './lib/graph'
import { formatTimestamp } from './lib/transcript'
import { KindLabel, KindMark, LINK, StatusText, fmtDate } from './ui'

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

  const cardInset = (L.colW - L.cardW) / 2

  return (
    <div
      ref={scroller}
      className="thin-scroll canvas-bg absolute inset-0 cursor-grab overflow-auto active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
    >
      <div className="relative mx-auto pb-24" style={{ width: layout.width, minHeight: '100%' }}>
        {/* Meeting headers */}
        <div className="sticky top-0 z-30 border-b border-line bg-paper" style={{ height: L.headerH }}>
          <div className="sticky left-0 z-10 flex h-full flex-col justify-end bg-paper pb-5 pl-7 pr-3" style={{ width: L.laneLabelW }}>
            <div className="text-[12px] text-ink-3">Kestrel</div>
            <div className="font-serif text-[21px] font-semibold leading-tight">Pulse launch</div>
            <div className="mt-1 text-[12px] text-ink-3">
              {totals.revised} revised
              {totals.open > 0 && (
                <>
                  {' · '}
                  <span className="text-blocker">
                    {totals.open} open blocker{totals.open > 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>
          </div>

          {layout.columns.map((c, i) => {
            const m = c.meeting
            const active = p.selectedMeetingId === m.id
            const engine = m.engine === 'claude' ? ' · Claude' : m.engine === 'on-device' ? ' · On-device' : ''
            return (
              <motion.button
                key={m.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05 + i * 0.06 }}
                onClick={() => p.onSelectMeeting(m.id)}
                className="group absolute bottom-0 flex flex-col items-start pb-5 text-left"
                style={{ left: c.x + cardInset, width: L.cardW }}
              >
                <span className="text-[12px] tabular-nums text-ink-3">{fmtDate(m.date)}</span>
                <span
                  className={`mt-0.5 max-w-full truncate font-serif text-[17px] font-semibold leading-snug underline-offset-4 ${active ? 'text-decision underline decoration-decision/40' : 'group-hover:underline decoration-ink/20'}`}
                >
                  {m.title}
                </span>
                <span className="mt-0.5 text-[12px] text-ink-3">
                  {m.attendees.length} people · {m.durationMin} min{engine}
                </span>
              </motion.button>
            )
          })}
        </div>

        {/* Lanes */}
        <div className="relative" style={{ height: layout.bodyH }}>
          <div className="sticky left-0 z-20 h-full border-r border-line bg-paper" style={{ width: L.laneLabelW }}>
            {layout.lanes.map((lane) => {
              const { current, openBlockers } = threadNow(ws, statuses, lane.thread.id)
              return (
                <div key={lane.thread.id} className="absolute left-0 right-0 pl-7 pr-5" style={{ top: lane.y + L.lanePad, height: lane.h }}>
                  <div className="text-[13.5px] font-semibold text-ink">{lane.thread.name}</div>
                  {current && (
                    <button onClick={() => p.onSelect(current.id)} className="mt-1 block text-left text-[12.5px] leading-snug text-ink-2 hover:text-ink">
                      <span className="line-clamp-2">{current.title}</span>
                    </button>
                  )}
                  {openBlockers.length > 0 && (
                    <button
                      onClick={() => p.onSelect(openBlockers[0].id)}
                      className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-blocker hover:underline"
                    >
                      <KindMark kind="blocker" size={6} />
                      {openBlockers.length} open blocker{openBlockers.length > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {layout.lanes.map((lane) => (
            <div key={lane.thread.id} className="absolute left-0 right-0 border-b border-line" style={{ top: lane.y, height: lane.h }} />
          ))}

          <Edges {...p} />

          {ws.items.map((it) => (
            <Card
              key={it.id}
              item={it}
              {...p}
              delay={0.15 + (meetingIndex.get(it.meetingId) ?? 0) * 0.1 + (layout.pos[it.id]?.lane ?? 0) * 0.02}
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
    const delay = 0.35 + (col.get(items.get(e.to)!.meetingId) ?? 0) * 0.14
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
          <motion.path
              key={e.id}
              d={d}
              fill="none"
              stroke={LINK[e.type].color}
              strokeLinecap="round"
              markerEnd={`url(#arrow-${e.type})`}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: dim ? 0.1 : on ? 1 : 0.5, strokeWidth: on ? 2 : 1.4 }}
              transition={{ pathLength: { duration: 0.7, delay, ease: 'easeInOut' }, opacity: { duration: 0.2 }, strokeWidth: { duration: 0.2 } }}
            />
        ))}
      </svg>
      {paths
        .filter((x) => x.on && !x.same)
        .map(({ e, mid }) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pointer-events-none absolute z-[5] -translate-x-1/2 -translate-y-1/2 bg-paper px-1 text-[11px] font-medium"
            style={{ left: mid.x, top: mid.y, color: LINK[e.type].color }}
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
  const selected = p.selectedId === item.id
  const fresh = p.fresh.has(item.id)
  const filteredOut = p.filter !== 'all' && p.filter !== item.kind
  const dim = filteredOut || (!!p.focus && !p.focus.has(item.id))
  // No longer current: superseded decisions and resolved blockers.
  const past = status === 'superseded' || status === 'resolved'

  return (
    <motion.div
      className="absolute z-10"
      style={{ width: L.cardW, height: L.cardH }}
      initial={{ opacity: 0, y: 6, left: pos.x, top: pos.y }}
      animate={{ opacity: 1, y: 0, left: pos.x, top: pos.y }}
      transition={{
        default: { duration: 0.35, ease: 'easeOut', delay },
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
        className={`flex h-full w-full cursor-pointer flex-col rounded-[10px] border px-3.5 py-3 text-left outline-none transition-[opacity,border-color,background-color] duration-150 focus-visible:border-ink ${
          selected
            ? 'border-ink bg-white'
            : past
              ? 'border-dashed border-ink/20 bg-paper hover:border-ink/40'
              : 'border-line bg-white hover:border-ink/35'
        }`}
        style={{ opacity: dim ? 0.25 : 1 }}
      >
        <div className="flex items-center justify-between gap-2">
          <KindLabel kind={item.kind} faded={past} />
          <span className="text-[11px] tabular-nums text-ink-3">{formatTimestamp(meeting.transcript[item.evidence.start]?.t ?? 0)}</span>
        </div>
        <div className={`mt-1.5 line-clamp-2 text-[13.5px] font-semibold leading-[1.3] ${past ? 'text-ink-3' : 'text-ink'}`}>{item.title}</div>
        <div className="mt-auto flex items-center gap-2 text-[11.5px] text-ink-3">
          {item.owner && <span className="truncate">{item.owner}</span>}
          <span className="ml-auto flex items-center gap-2">
            {fresh && <span className="font-medium text-violet">New</span>}
            <StatusText status={status} />
          </span>
        </div>
      </button>
    </motion.div>
  )
}
