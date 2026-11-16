import { CircleCheck, OctagonAlert, Shuffle, type LucideIcon } from 'lucide-react'
import type { ItemKind, LinkType } from './types'
import type { StatusLabel } from './lib/graph'

export const KIND: Record<ItemKind, { label: string; color: string; soft: string; Icon: LucideIcon }> = {
  decision: { label: 'Decision', color: 'var(--color-decision)', soft: '#e3f1f2', Icon: CircleCheck },
  blocker: { label: 'Blocker', color: 'var(--color-blocker)', soft: '#fbe8e8', Icon: OctagonAlert },
  change: { label: 'Change', color: 'var(--color-change)', soft: '#f8eedd', Icon: Shuffle },
}

/** Wording for a link seen from the newer item ("out") and from the older item ("in"). */
export const LINK: Record<LinkType, { label: string; out: string; in: string; color: string }> = {
  revises: { label: 'revises', out: 'Revises', in: 'Revised by', color: '#c77a0a' },
  blocks: { label: 'blocks', out: 'Blocks', in: 'Blocked by', color: '#df4a4f' },
  resolves: { label: 'resolves', out: 'Resolves', in: 'Resolved by', color: '#15936a' },
  builds_on: { label: 'builds on', out: 'Builds on', in: 'Followed by', color: '#8f9ca2' },
}

export const STATUS: Record<StatusLabel, { label: string; className: string } | null> = {
  active: null,
  superseded: { label: 'Superseded', className: 'bg-ink/[0.06] text-ink-3' },
  blocked: { label: 'Blocked', className: 'bg-blocker/10 text-blocker' },
  open: { label: 'Open', className: 'bg-blocker/10 text-blocker' },
  resolved: { label: 'Resolved', className: 'bg-resolve/10 text-resolve' },
}

export function StatusChip({ status }: { status: StatusLabel }) {
  const s = STATUS[status]
  if (!s) return null
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-px text-[10.5px] font-semibold ${s.className}`}>
      {status === 'open' && <span className="mr-1 size-1.5 rounded-full bg-blocker animate-pulse" />}
      {s.label}
    </span>
  )
}

export function KindBadge({ kind, size = 'sm' }: { kind: ItemKind; size?: 'sm' | 'md' }) {
  const k = KIND[kind]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${size === 'md' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-px text-[10.5px]'}`}
      style={{ color: k.color, background: k.soft }}
    >
      <k.Icon className={size === 'md' ? 'size-3.5' : 'size-3'} strokeWidth={2.4} />
      {k.label}
    </span>
  )
}

const AVATAR_COLORS = ['#0b7a88', '#6a3df0', '#c77a0a', '#d14d72', '#2f6fdb', '#15936a', '#7a5c3e', '#9b4dca']

function hash(s: string) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

export function Avatar({ name, size = 22, ring = false, single = false }: { name: string; size?: number; ring?: boolean; single?: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, single ? 1 : 2)
    .join('')
    .toUpperCase()
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${ring ? 'ring-2 ring-white' : ''}`}
      style={{ width: size, height: size, fontSize: size * (single ? 0.46 : 0.4), background: AVATAR_COLORS[hash(name) % AVATAR_COLORS.length] }}
    >
      {initials}
    </span>
  )
}

export function AvatarStack({ names, max = 4, size = 20 }: { names: string[]; max?: number; size?: number }) {
  const shown = names.slice(0, max)
  return (
    <span className="flex items-center -space-x-1">
      {shown.map((n) => (
        <Avatar key={n} name={n} size={size} ring single />
      ))}
      {names.length > max && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-paper-2 font-semibold text-ink-2 ring-2 ring-white"
          style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
          +{names.length - max}
        </span>
      )}
    </span>
  )
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return new Date(iso).toLocaleDateString('en-US', opts)
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#1d2a30" />
      <path d="M8 21 C 13 21, 13 11, 18 11 L 24 11" stroke="#7fd3dc" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M13.5 16 C 16 21, 19 21, 24 21" stroke="#f2b45a" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeDasharray="0.1 4.2" />
      <circle cx="8" cy="21" r="2.6" fill="#fff" />
      <circle cx="24" cy="11" r="2.6" fill="#7fd3dc" />
      <circle cx="24" cy="21" r="2.6" fill="#f2b45a" />
    </svg>
  )
}
