import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { Check, KeyRound, LoaderCircle, Upload, X } from 'lucide-react'
import type { Engine, Meeting, Workspace } from './types'
import { parseTranscript, speakersOf, formatTimestamp } from './lib/transcript'
import { extractHeuristic } from './lib/extract/heuristic'
import { extractWithClaude } from './lib/extract/claude'
import { applyExtraction, type RawItem } from './lib/extract/normalize'
import { retroExample } from './data/transcripts'

const KEY_STORAGE = 'decision-trails.anthropic-key'
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Props {
  ws: Workspace
  onClose: () => void
  onDone: (ws: Workspace, itemIds: string[], meetingId: string) => void
}

type Phase = { name: 'form' } | { name: 'running'; step: number } | { name: 'error'; message: string }

export function UploadDialog({ ws, onClose, onDone }: Props) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [text, setText] = useState('')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(KEY_STORAGE) ?? '')
  const [engine, setEngine] = useState<Exclude<Engine, 'sample'>>(() => (localStorage.getItem(KEY_STORAGE) ? 'claude' : 'on-device'))
  const [phase, setPhase] = useState<Phase>({ name: 'form' })
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const lines = useMemo(() => parseTranscript(text), [text])
  const speakers = speakersOf(lines)
  const ready = lines.length > 0 && title.trim() && (engine === 'on-device' || apiKey.trim())

  const steps = [
    'Reading the transcript',
    engine === 'claude' ? 'Claude is finding decisions, blockers, and changes' : 'Finding decisions, blockers, and changes',
    `Linking to ${ws.items.length} items from earlier meetings`,
    'Placing them on the map',
  ]

  const readFile = async (file: File) => {
    setText(await file.text())
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
  }

  const useExample = () => {
    setTitle('Pulse retro')
    setDate('2026-11-12')
    setText(retroExample)
  }

  const run = async (use: Exclude<Engine, 'sample'>) => {
    setEngine(use)
    setPhase({ name: 'running', step: 0 })
    if (use === 'claude') localStorage.setItem(KEY_STORAGE, apiKey.trim())
    const meeting: Meeting = {
      id: `u${Date.now().toString(36)}`,
      title: title.trim(),
      date: `${date}T12:00:00`,
      durationMin: Math.max(1, Math.ceil((lines.at(-1)?.t ?? 0) / 60)),
      attendees: speakers,
      transcript: lines,
      engine: use,
    }
    try {
      await wait(450)
      setPhase({ name: 'running', step: 1 })
      let raw: RawItem[]
      if (use === 'claude') raw = await extractWithClaude(apiKey.trim(), ws, meeting)
      else {
        await wait(900)
        raw = extractHeuristic(ws, meeting)
      }
      setPhase({ name: 'running', step: 2 })
      const result = applyExtraction(ws, meeting, raw)
      await wait(650)
      setPhase({ name: 'running', step: 3 })
      await wait(450)
      onDone(result.workspace, result.itemIds, meeting.id)
    } catch (e) {
      setPhase({ name: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && phase.name !== 'running' && onClose()}
    >
      <motion.div
        initial={{ y: 16, scale: 0.98, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 10, scale: 0.98, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 34 }}
        className="relative w-full max-w-[600px] overflow-hidden rounded-xl border border-line bg-white shadow-[0_24px_60px_-28px_rgba(29,42,48,0.45)]"
      >
        <div className="flex items-start justify-between px-6 pb-1 pt-5">
          <div>
            <h2 className="font-serif text-[22px] font-semibold">Add a meeting</h2>
            <p className="mt-0.5 text-[13px] text-ink-2">Decision Trails finds what was decided and connects it to earlier meetings.</p>
          </div>
          {phase.name !== 'running' && (
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-3 hover:bg-paper hover:text-ink">
              <X className="size-4" />
            </button>
          )}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {phase.name === 'running' ? (
            <motion.div key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-6 pb-7 pt-5">
              <div className="rounded-lg border border-line p-5">
                <div className="mb-4 flex items-center gap-2 text-[13px] text-ink-2">
                                    <span className="font-medium text-ink">{title}</span>
                  <span className="text-ink-3">
                    · {lines.length} lines · {speakers.length} speakers
                  </span>
                </div>
                <ol className="space-y-3">
                  {steps.map((s, i) => {
                    const done = phase.step > i
                    const active = phase.step === i
                    return (
                      <li key={s} className={`flex items-center gap-3 text-[14px] transition-colors ${done || active ? 'text-ink' : 'text-ink-3'}`}>
                        <span className="flex size-5 items-center justify-center">
                          {done ? (
                            <Check className="size-4 text-resolve" strokeWidth={2.5} />
                          ) : active ? (
                            <LoaderCircle className={`size-4 animate-spin text-ink-2`} />
                          ) : (
                            <span className="size-1.5 rounded-full bg-ink/20" />
                          )}
                        </span>
                        {s}
                      </li>
                    )
                  })}
                </ol>
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 px-6 pb-6 pt-4">
              {phase.name === 'error' && (
                <div className="rounded-lg border border-line p-3.5 text-[13px] text-ink">
                  <div className="font-semibold text-blocker">Extraction failed</div>
                  <div className="mt-0.5 text-ink-2">{phase.message}</div>
                  <button onClick={() => run('on-device')} className="mt-2 font-medium text-decision hover:underline">
                    Use on-device extraction instead
                  </button>
                </div>
              )}

              <div className="grid grid-cols-[1fr_150px] gap-3">
                <label className="block">
                  <span className="text-[12px] font-medium text-ink-2">Meeting title</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Pulse retro"
                    className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-[14px] outline-none transition-shadow focus:border-decision/50 focus:ring-3 focus:ring-decision/15"
                  />
                </label>
                <label className="block">
                  <span className="text-[12px] font-medium text-ink-2">Date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-[14px] outline-none focus:border-decision/50 focus:ring-3 focus:ring-decision/15"
                  />
                </label>
              </div>

              <div>
                <div className="flex items-end justify-between">
                  <span className="text-[12px] font-medium text-ink-2">Transcript</span>
                  <button onClick={useExample} className="text-[12px] font-medium text-decision hover:underline">
                    Use example: Pulse retro, Nov 12
                  </button>
                </div>
                <div
                  className={`relative mt-1 rounded-xl border transition-colors ${dragging ? 'border-decision bg-decision/[0.04]' : 'border-line'}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragging(false)
                    const file = e.dataTransfer.files[0]
                    if (file) readFile(file)
                  }}
                >
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    spellCheck={false}
                    placeholder={'[00:12] Maya Chen: Welcome, everyone…\n[01:20] Marcus Bell: Then let\'s start charging on December 1.'}
                    className="thin-scroll block h-[168px] w-full resize-none rounded-xl bg-transparent px-3.5 py-3 font-mono text-[12px] leading-relaxed outline-none placeholder:text-ink-3/70"
                  />
                  {!text && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                      <button
                        onClick={() => fileInput.current?.click()}
                        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-2 shadow-sm hover:text-ink"
                      >
                        <Upload className="size-3.5" /> Drop or choose a .txt file
                      </button>
                    </div>
                  )}
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".txt,.md,text/plain"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
                  />
                </div>
                <div className="mt-1.5 h-4 text-[11.5px] text-ink-3">
                  {text &&
                    (lines.length
                      ? `${lines.length} lines · ${speakers.length} speakers · ${formatTimestamp(lines.at(-1)!.t)} long`
                      : 'Use one line per turn, such as "[04:26] Maya Chen: Let\'s commit."')}
                </div>
              </div>

              <div>
                <span className="text-[12px] font-medium text-ink-2">Extraction</span>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <EngineOption
                    active={engine === 'claude'}
                    onClick={() => setEngine('claude')}
                    title="Claude"
                    detail="Best quality. Uses your API key."
                  />
                  <EngineOption
                    active={engine === 'on-device'}
                    onClick={() => setEngine('on-device')}
                    title="On-device"
                    detail="No key. Rule-based, runs in your browser."
                  />
                </div>
                <AnimatePresence initial={false}>
                  {engine === 'claude' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <label className="mt-2 flex items-center gap-2 rounded-lg border border-line px-3 py-2 focus-within:border-violet/40 focus-within:ring-3 focus-within:ring-violet/10">
                        <KeyRound className="size-4 text-ink-3" />
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Anthropic API key (sk-ant-…)"
                          className="flex-1 bg-transparent text-[13px] outline-none"
                        />
                      </label>
                      <p className="mt-1 text-[11.5px] text-ink-3">The key stays in this browser and goes only to api.anthropic.com.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={onClose} className="rounded-lg px-3.5 py-2 text-[13.5px] font-medium text-ink-2 hover:bg-paper">
                  Cancel
                </button>
                <button
                  disabled={!ready}
                  onClick={() => run(engine)}
                  className="rounded-md bg-ink px-4 py-2 text-[13.5px] font-medium text-white transition-colors hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Find decisions
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

function EngineOption(p: { active: boolean; onClick: () => void; title: string; detail: string }) {
  return (
    <button
      onClick={p.onClick}
      className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors ${p.active ? 'border-ink' : 'border-line hover:border-ink/30'}`}
    >
      <span className={`mt-[3px] flex size-3.5 shrink-0 items-center justify-center rounded-full border ${p.active ? 'border-ink' : 'border-ink/30'}`}>
        {p.active && <span className="size-1.5 rounded-full bg-ink" />}
      </span>
      <span>
        <span className="block text-[13.5px] font-medium">{p.title}</span>
        <span className="block text-[12px] leading-snug text-ink-3">{p.detail}</span>
      </span>
    </button>
  )
}
