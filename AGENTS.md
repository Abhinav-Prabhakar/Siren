<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Workflow rules (user-set)

- NEVER run `next dev`, `next start`, or any other server — the user runs the dev server themselves. Verify changes with `npm run build` / `npm run lint` only.
- Commit and push to `main` frequently — after every logical chunk of work, always push.

## Design language

- Gamified emergency-dispatch HUD. Everything red on near-black; absolutely no border radius.
- Design system lives in `src/components/ui/` and is showcased at the `/components` route.
