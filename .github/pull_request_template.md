<!--
Title: a Conventional Commit header, e.g. `fix: color rust lifetimes as attributes`.
PRs are squash-merged and the title becomes the commit on main: lowercase,
imperative, 72 characters at most (aim for 50).

Keep every heading. Tick a box only for a command you ran on this branch;
otherwise leave it unticked and say why below it.
-->

## What and why

<!-- What changes and the problem it solves. Link the issue: `Closes #123`. -->

## Checks

- [ ] `pnpm lint && pnpm typecheck`
- [ ] `pnpm check` (the theme matches `src/` and the spec)
- [ ] `pnpm verify` (VS Code and Cursor load it; no unknown, unapplied or stray colors)

## Colors

- [ ] Edited `src/`, then ran `pnpm generate` (`themes/` is never edited by hand)
- [ ] Colors come from roles in `src/colors.ts`; no new hex values

## Screenshots

<!-- Before and after for any visible change. `pnpm render` regenerates the
README screenshots. Delete if nothing visible changed. -->

<!-- Releasing? Merge first, then bump `version` in package.json with a
CHANGELOG.md entry in its own PR and push a matching tag `v<version>`. -->
