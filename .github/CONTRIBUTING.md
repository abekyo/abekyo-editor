# Contributing to Abekyo Editor

Thanks for your interest in making this project better. Abekyo Editor is a small, focused open-source video editor — we'd rather ship a handful of polished features than a sprawling feature matrix. Contributions that keep the scope tight are the most useful.

## Before you start

- **Search existing issues** first — someone may already be on it.
- For anything larger than a bug fix, **open an issue before coding**. A 10-line description saves a 500-line PR that has to be rewritten.
- Keep PRs **single-purpose**. A refactor + a feature + a bug fix in one PR is three PRs disguised as one.

## Development setup

```bash
git clone https://github.com/<your-fork>/Abekyo-editor.git
cd Abekyo-editor
npm install
npm run dev
```

Open http://localhost:3000. No environment variables are required for local development.

### Scripts you'll use

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check (we keep this at zero errors) |

**Type-check must pass before you open a PR.** Run `npx tsc --noEmit` locally.

## What kinds of contributions we welcome

### Very welcome

- **Additional UI languages.** Drop a new `messages/<locale>.json` mirroring the EN structure. See the *Adding a new language* section below.
- **New transitions and image effects.** See `src/Transitions.tsx` and `src/ImageEffects.tsx`.
- **Accessibility fixes.** Focus rings, screen-reader labels, `prefers-reduced-motion` support, keyboard nav.
- **Mobile / tablet responsiveness.** The editor assumes >1024px; patches that degrade gracefully on narrow viewports are very welcome.
- **Object-storage adapters** for `app/api/upload/route.ts` and `app/api/render/route.ts` output (S3, R2, GCS).
- **Bug fixes with a reproduction case.**

### Probably not

- **Paid-service integrations.** No OpenAI, Stripe, analytics, or anything requiring API keys in the default path. Fork if you need them.
- **Auth / user accounts.** This project is single-user / self-hosted by design.
- **Feature flags and plan gates.** Not in scope for this project — fork if you need them.
- **Additional runtime dependencies that are paid** (hosted services, saas add-ons).

### Need to discuss first

- Structural refactors of `components/VideoEditor.tsx`. It coordinates several sub-panels, so reorganisations benefit from up-front discussion in an issue.
- Changing the export pipeline (`/api/render`). Remotion-specific tuning is fine; replacing the engine is a conversation.
- Adding dependencies that aren't strictly needed.

## Coding conventions

- **TypeScript strict.** No `any` additions without justification.
- **Keep i18n keys in sync.** If you add a key to `messages/en.json`, add it to `messages/ja.json` (and any other locale). A translator fallback is fine; a missing key is not.
- **Tailwind for styling.** Utility classes, no CSS-in-JS.
- **Minimal comments.** Don't narrate the obvious. Do explain non-obvious *why*.
- **Comments in English.** Keep all new code comments in English.
- **No emoji in file names or branch names.** (Emoji in UI strings are fine — we use them.)

### File-layout conventions

- Client components live in `components/`.
- Server-only (Remotion compositions) live in `src/`.
- Shared types live in `lib/types/` or next to the consumer.
- Public helpers live in `lib/utils/`.
- One React component per file unless subcomponents are trivially small.

## Adding a new language

1. Copy `messages/en.json` to `messages/<code>.json`.
2. Translate every value. Do not change the key structure.
3. Add the locale code to `i18n/routing.ts` (`locales` array and `prefixes` map if applicable).
4. Add a button in `components/LanguageSwitcher.tsx`.
5. Open a PR. In the description, mention your native fluency level for reviewer context.

Run `npm run i18n:check` before opening the PR — it diffs key sets across every `messages/*.json` and will flag anything you missed.

## Writing a good PR

- **Title**: short, imperative. "Add Spanish locale", not "Spanish".
- **Description**: what, why, how. Include a screenshot or short screencap for UI changes.
- **Check the boxes** in the PR template (`PULL_REQUEST_TEMPLATE.md`).
- **Rebase over merge** where possible — keep history linear.
- **Run `npx tsc --noEmit` and `npm run lint` before pushing.** PRs with red CI tend to stall.

## Reporting bugs

Use the **Bug report** issue template. A good bug report contains:

- Version (commit SHA).
- What you did (reproduction steps — 1, 2, 3).
- What you expected.
- What actually happened.
- Browser + OS.
- Whether it's a first-render issue (Chrome Headless Shell download) or a steady-state issue.

If the bug is in the editor UI, a short screencap helps enormously.

## Requesting features

Use the **Feature request** issue template. Describe the problem first, the proposed solution second. "I can't add text overlays" is a better starting point than "please add a text-overlay subsystem".

## Code of conduct

This project follows the [Contributor Covenant](../CODE_OF_CONDUCT.md). Be kind; disagreements happen in public; moderation happens in private.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](../LICENSE), matching the rest of the project.
