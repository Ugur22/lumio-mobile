# Agent harness

Status: approved (2026-11-12). Steps 1-7 merged; 8 is the e2e docs PR, and the plan is done when it merges. The backend side (`e2e-mobile-server`) lives in Ugur22/lumio.

## Goal
Enforce in code what AGENTS.md only asks for in text, using the backend repo (Ugur22/lumio) as the reference: hooks, permissions, a reviewer agent, guardrails, plans, and a way to check the UI and e2e against a stub backend.

## Steps
One branch and PR per step, one commit per step.

1. **Hooks (#12, merged):** `npm run check`; the Stop hook runs it with a stamp skip and a 3-block cap; a PostToolUse hook runs eslint on each edited file.
   Verify: Stop script exercised by hand (skip, 3 blocks, reset); eslint call exits 1 on a broken file.
2. **Permissions (#13, merged):** deny, ask and allow rules in `.claude/settings.json` for what AGENTS.md only asks for.
   Verify: `/permissions` lists the rules without errors.
3. **Reviewer agent (#14, merged):** read-only `.claude/agents/reviewer.md`.
   Verify: dry run on the hooks PR diff; `/agents` lists it in a new session.
4. **Guardrails (#15):** 400-line file limit and a test-count baseline, in `npm run check` and CI.
   Verify: each script fails on a probe (401-line file, grown baselined file, lower test count).
4b. **Secret scan (#16):** a gitleaks job in CI.
   Verify: the job passes on its own PR.
5. **Plans and review (plans-and-review):** this template, the workflow rules and the PR template in AGENTS.md.
   Verify: the reviewer, given this plan and the diff, reports no skipped step.
6. **Stub server URL:** `EXPO_PUBLIC_LUMIO_SERVER` overrides `DEFAULT_SERVER` in `src/lib/config.ts`.
   Verify: Vitest for the override; the stub backend (`make e2e-mobile-server` in Ugur22/lumio) answers `/api/auth/token` for `demo` (checked with curl: token returned).
7. **Visual check:** `scripts/visual-check.sh` with a `--needed` trigger, `.maestro/visual/` flows against the stub, git-ignored screenshots and the AGENTS.md rule (no skill: the rule and the script cover it). Runs once at the end of a task, never in the Stop hook.
   Verify: `--needed` triggers and skips as AGENTS.md says (probe edits); the simulator run is done by the user, because Claude's sandbox cannot reach the simulator.
8. **e2e docs:** document the local e2e step (against the stub) and add it to the PR template's Check section.
   Verify: every command in the README section was run on a simulator during the visual-check work (stub start, `--needed`, `--force`, `--flows`).

## Out of scope
- Running e2e in CI (macOS runner, EAS Workflows and Maestro Cloud were weighed; local with the stub wins for now).
- Fixing the existing hardcoded colors and `StyleSheet` use in `Composer.tsx` and `src/app/(drawer)/index.tsx`.

## Open questions
- Resolved: the backend's e2e mode needs a seeded `demo` admin and a public host, which the `e2e-mobile-server` target (a PR in Ugur22/lumio) provides.
- Resolved by the first simulator runs: `demo` sees the "E2E Stub" provider; the login, provider-sheet, drawer and chat flows run in light and dark. The backend needed one more change, letting a deployed-mode server reach the e2e stub upstream.
- Still open: the keyboard screenshot shows no keyboard until the simulator's hardware keyboard is turned off (I/O > Keyboard, or the shortcut in the simulator); a dark-mode strip beside the sliding chat in the open drawer, to fix in its own PR.
