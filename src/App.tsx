import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Plus, RotateCcw } from 'lucide-react'
import type { ItemKind, Workspace } from './types'
import { sampleWorkspace } from './data/workspace'
import { computeLayout, edgesOf, statusesOf, trailOf } from './lib/graph'
import { Canvas } from './Canvas'
import { Panel, type Selection } from './Panel'
import { UploadDialog } from './UploadDialog'
import { KIND, KindMark, LINK, Logo } from './ui'

const STORAGE = 'decision-trails.added.v1'

/** Only the meetings a visitor added are saved; the sample always comes from code. */
function load(): Workspace {
  try {
    const added = JSON.parse(localStorage.getItem(STORAGE) ?? 'null')
    if (added)
      return {
        ...sampleWorkspace,
        meetings: [...sampleWorkspace.meetings, ...added.meetings],
        threads: [...sampleWorkspace.threads, ...added.threads],
        items: [...sampleWorkspace.items, ...added.items],
      }
  } catch {
    localStorage.removeItem(STORAGE)
  }
  return sampleWorkspace
}

function save(ws: Workspace) {
  const sample = (list: { id: string }[]) => new Set(list.map((x) => x.id))
  const [m, t, i] = [sample(sampleWorkspace.meetings), sample(sampleWorkspace.threads), sample(sampleWorkspace.items)]
  localStorage.setItem(
    STORAGE,
    JSON.stringify({
      meetings: ws.meetings.filter((x) => !m.has(x.id)),
      threads: ws.threads.filter((x) => !t.has(x.id)),
      items: ws.items.filter((x) => !i.has(x.id)),
    }),
  )
}

const FILTERS: ('all' | ItemKind)[] = ['all', 'decision', 'blocker', 'change']

export default function App() {
  const [ws, setWs] = useState(load)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | ItemKind>('all')
  const [uploading, setUploading] = useState(false)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [scrollTo, setScrollTo] = useState<{ meetingId: string; key: number } | null>(null)
  const [explored, setExplored] = useState(false)
  const [found, setFound] = useState<{ meetingId: string; title: string; count: number } | null>(null)

  const layout = useMemo(() => computeLayout(ws), [ws])
  const statuses = useMemo(() => statusesOf(ws), [ws])
  const edges = useMemo(() => edgesOf(ws), [ws])
  const added = ws.meetings.length > sampleWorkspace.meetings.length

  const focusId = hover ?? (selection?.type === 'item' ? selection.id : null)
  const focus = useMemo(() => {
    if (focusId) return trailOf(ws, focusId)
    if (selection?.type === 'meeting') return new Set(ws.items.filter((it) => it.meetingId === selection.id).map((it) => it.id))
    return null
  }, [ws, focusId, selection])

  const select = useCallback((s: Selection | null) => {
    setSelection(s)
    if (s) setExplored(true)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !uploading && setSelection(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [uploading])

  const counts = {
    all: ws.items.length,
    decision: ws.items.filter((i) => i.kind === 'decision').length,
    blocker: ws.items.filter((i) => i.kind === 'blocker').length,
    change: ws.items.filter((i) => i.kind === 'change').length,
  }

  return (
    <div className="flex h-full flex-col">
      <header className="relative z-40 flex h-14 shrink-0 items-center gap-4 border-b border-line bg-white px-5">
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Decision Trails</span>
          <span className="hidden text-[13px] text-ink-3 md:inline">· a concept for Fellow</span>
        </div>

        <div className="mx-auto flex items-center gap-1" role="tablist" aria-label="Filter by type">
          {FILTERS.map((f) => {
            const active = filter === f
            return (
              <button
                key={f}
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f)}
                className={`relative rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${active ? 'text-ink' : 'text-ink-3 hover:text-ink-2'}`}
              >
                {active && (
                  <motion.span layoutId="filter-pill" className="absolute inset-0 rounded-md bg-paper-2" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
                )}
                <span className="relative flex items-center gap-1.5">
                  {f !== 'all' && <KindMark kind={f} size={6} />}
                  {f === 'all' ? 'All' : `${KIND[f].label}s`}
                  <span className="tabular-nums text-ink-3">{counts[f]}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          {added && (
            <button
              onClick={() => {
                localStorage.removeItem(STORAGE)
                setWs(sampleWorkspace)
                setSelection(null)
                setFresh(new Set())
                setFound(null)
              }}
              title="Remove added meetings"
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-ink-3 hover:bg-paper hover:text-ink"
            >
              <RotateCcw className="size-3.5" /> Reset
            </button>
          )}
          <button
            onClick={() => setUploading(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-ink/85"
          >
            <Plus className="size-4" /> Add meeting
          </button>
        </div>
      </header>

      <main className="relative flex-1 overflow-hidden">
        <Canvas
          ws={ws}
          layout={layout}
          statuses={statuses}
          edges={edges}
          focus={focus}
          selectedId={selection?.type === 'item' ? selection.id : null}
          selectedMeetingId={selection?.type === 'meeting' ? selection.id : null}
          filter={filter}
          fresh={fresh}
          scrollTo={scrollTo}
          onHover={(id) => {
            setHover(id)
            if (id) setExplored(true)
          }}
          onSelect={(id) => select({ type: 'item', id })}
          onSelectMeeting={(id) => select({ type: 'meeting', id })}
          onBackground={() => setSelection(null)}
        />

        <Legend hint={!explored} />

        <AnimatePresence>
          {found && !selection && (
            <motion.button
              key={found.meetingId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 1.2 } }}
              exit={{ opacity: 0, y: 12 }}
              onClick={() => {
                select({ type: 'meeting', id: found.meetingId })
                setFound(null)
              }}
              className="absolute bottom-14 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-line bg-white px-4 py-2.5 text-[13px] text-ink-2 shadow-[0_8px_24px_-12px_rgba(29,42,48,0.3)]"
            >
              Found {found.count} item{found.count === 1 ? '' : 's'} in {found.title}
              <span className="inline-flex items-center gap-1 font-medium text-decision">
                Review <ArrowRight className="size-3.5" />
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selection && <Panel key="panel" ws={ws} statuses={statuses} selection={selection} onSelect={select} onClose={() => setSelection(null)} />}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {uploading && (
          <UploadDialog
            ws={ws}
            onClose={() => setUploading(false)}
            onDone={(next, itemIds, meetingId) => {
              setWs(next)
              save(next)
              setUploading(false)
              setFresh(new Set(itemIds))
              setSelection(null)
              setScrollTo({ meetingId, key: Date.now() })
              setExplored(true)
              setFound({ meetingId, title: next.meetings.find((m) => m.id === meetingId)!.title, count: itemIds.length })
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function Legend({ hint }: { hint: boolean }) {
  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-30 flex items-center gap-5 border-t border-line bg-paper px-7 py-2.5 text-[12px] text-ink-3">
      {(Object.keys(KIND) as ItemKind[]).map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <KindMark kind={k} size={6} />
          {KIND[k].label}
        </span>
      ))}
      <span className="h-3 w-px bg-line" />
      {Object.entries(LINK).map(([type, l]) => (
        <span key={type} className="flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden>
            <line x1="1" y1="4" x2="11" y2="4" stroke={l.color} strokeWidth="1.6" strokeLinecap="round" />
            <path d="M10 1.5 L15 4 L10 6.5 z" fill={l.color} />
          </svg>
          {l.label}
        </span>
      ))}
      <AnimatePresence>
        {hint && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 1 } }} exit={{ opacity: 0 }} className="ml-auto">
            Hover a card to trace its history. Click it to read the source.
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
