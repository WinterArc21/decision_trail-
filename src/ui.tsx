import type { ItemKind, LinkType } from './types'
import type { StatusLabel } from './lib/graph'

export const KIND: Record<ItemKind, { label: string; color: string }> = {
  decision: { label: 'Decision', color: 'var(--color-decision)' },
  blocker: { label: 'Blocker', color: 'var(--color-blocker)' },
  change: { label: 'Change', color: 'var(--color-change)' },
}

/** Wording for a link seen from the newer item ("out") and from the older item ("in"). */
export const LINK: Record<LinkType, { label: string; out: string; in: string; color: string }> = {
  revises: { label: 'revises', out: 'Revises', in: 'Revised by', color: '#c27a14' },
  blocks: { label: 'blocks', out: 'Blocks', in: 'Blocked by', color: '#cf4a4a' },
  resolves: { label: 'resolves', out: 'Resolves', in: 'Resolved by', color: '#1f8a64' },
  builds_on: { label: 'builds on', out: 'Builds on', in: 'Followed by', color: '#9aa4a8' },
}

const STATUS: Record<StatusLabel, { label: string; className: string } | null> = {
  active: null,
  superseded: { label: 'Superseded', className: 'text-ink-3' },
  blocked: { label: 'Blocked', className: 'text-blocker' },
  open: { label: 'Open', className: 'text-blocker' },
  resolved: { label: 'Resolved', className: 'text-resolve' },
}

export function StatusText({ status }: { status: StatusLabel }) {
  const s = STATUS[status]
  return s ? <span className={`text-[11.5px] font-medium ${s.className}`}>{s.label}</span> : null
}

/** A small shape per kind, so kinds stay distinct without color: circle, square, diamond. */
export function KindMark({ kind, size = 7, faded = false }: { kind: ItemKind; size?: number; faded?: boolean }) {
  const shape = kind === 'decision' ? 'rounded-full' : kind === 'change' ? 'rotate-45 rounded-[1px]' : 'rounded-[1px]'
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 ${shape}`}
      style={{ width: size, height: size, background: KIND[kind].color, opacity: faded ? 0.4 : 1 }}
    />
  )
}

export function KindLabel({ kind, faded = false }: { kind: ItemKind; faded?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-3">
      <KindMark kind={kind} faded={faded} />
      {KIND[kind].label}
    </span>
  )
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return new Date(iso).toLocaleDateString('en-US', opts)
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1d2a30" />
      <path d="M8 21 C 13 21, 13 11, 18 11 L 24 11" stroke="#9fd2d8" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="8" cy="21" r="2.4" fill="#fff" />
      <circle cx="24" cy="11" r="2.4" fill="#9fd2d8" />
    </svg>
  )
}
