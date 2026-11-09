# Working rules for AI coding agents — GBO Studio

**The Unreal Museum has ONE source of truth:** `main` of `GboStudio/gbostudio`, with public entry `empty-museum/index.html`. The name `empty-museum` is a historical URL, not another product.

Before any museum change:
1. Read `empty-museum/PROJECT_STATE.md` and `empty-museum/project-contract.json`.
2. Check the current GitHub `main` HEAD, any active PR affecting the same modules and the runtime imports from `index.html` / `engine-loader.js`. Do not rely on an old chat response or an old versioned filename.
3. Distinguish **discussed / approved / proposed in PR / merged / tested / deployed**. Do not promise it is live from a passing unit test or commit.
4. Make a focused change against current HEAD; do not revert or overwrite parallel changes. Prefer feature branches + CI + PR to direct production edits.
5. Update the project state for every accepted decision and delivered change, recording open contradictions. Update the machine contract and tests if invariants change.
6. Run `node .github/scripts/museum-coherence.mjs` and relevant unit, Playwright and public deployment checks. Never weaken or disable a failing check merely to avoid notification.
7. Prove deployed status with the exact GitHub Pages revision and a public browser check.
8. Keep demonstration prices and browser-only reservations clearly marked DEMO until secure server stock, authentication, moderation and real payments are in place.

GitHub Actions can validate **repository contents**, not private ChatGPT project conversations. A coordinating assistant must separately reconcile new decisions from conversations into this shared state.
