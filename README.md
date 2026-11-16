# Decision Trails

An independent concept for [Fellow](https://fellow.ai): a map of how a team's decisions evolve across meetings.

Meeting notes answer the question "What did we decide in this meeting?" But teams usually ask other questions: **"What is the current plan, and how did we get here?"** A decision made at a kickoff is changed two weeks later, blocked by a security review, and then resolved at a go/no-go meeting. That history is spread across four transcripts. Decision Trails puts it on one canvas.

## What it does

- **Map.** Meetings are columns in date order. Topics ("threads") are lanes. Each card is a decision, blocker, or change. Edges show how cards relate: _revises_, _blocks_, _resolves_, _builds on_.
- **Where it stands.** Each lane shows the latest active decision and any open blockers. Superseded decisions and resolved blockers stay visible but fade.
- **Trace.** Hover a card to light up its full trail across meetings. Click it to see the transcript excerpt and timestamps that support it, its connections, and how it evolved.
- **Add a meeting.** Paste or drop a transcript. The new meeting's decisions are extracted and linked to earlier meetings. A retro transcript is included to try.

## Extraction

| Engine | When | How |
| --- | --- | --- |
| Claude (`claude-sonnet-5-5`) | You give an Anthropic API key | The prompt includes earlier threads and items, so Claude can link new items to them by ID. Output is checked before use: unknown kinds and links are dropped, evidence is clamped to the transcript, and links can only point to earlier meetings. |
| On-device | No key | Rule-based: finds cue phrases, groups nearby lines, picks a thread by weighted word overlap, and links to the most related earlier item. It is a fallback, so the demo works for everyone. |

The key is used only in the browser, through Anthropic's direct browser access header. A production version would call Claude from Fellow's backend.

The four sample meetings ship pre-analyzed. Their evidence is stored as transcript timestamps and checked by tests, so every card points to real lines.

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # vitest: parser, statuses, on-device extraction, validation
pnpm build
```

React 19, TypeScript, Vite, Tailwind CSS 4, Motion. No backend.

## Code map

- `src/data/` has the fictional "Kestrel / Project Pulse" transcripts and the pre-analyzed sample.
- `src/lib/graph.ts` has the layout, edges, statuses (superseded, blocked, resolved), and trails.
- `src/lib/extract/` has the Claude engine, the on-device engine, and `applyExtraction`, which checks either engine's output and merges it into the workspace.
- `src/Canvas.tsx`, `src/Panel.tsx`, and `src/UploadDialog.tsx` are the UI.
