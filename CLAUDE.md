# Hibi

A static, dependency-free PWA for language learning (currently Japanese). No build step: plain ES modules served as-is (GitHub Pages deploys `main`).

- `js/core/`: language-neutral app (UI, FSRS scheduler, storage, speech). Must not contain language-specific strings or logic.
- `js/langs/<code>/`: language packs. Everything about a language lives here.
- The owner learns with this app and comes back to sessions to **generate new content instead of using an AI API**. Follow `CONTENT.md` exactly when adding words or stories. In particular, never rename or remove published ids or reorder story lines (saved progress depends on them), and run `node tools/validate.mjs <lang>` before committing (then again with `--update-lock`).
- If the owner shares a backup JSON (exported from Settings), run the validator with `--progress <file>` and write content pitched at the words they have started.
- After changing files that the service worker precaches, bump `VERSION` in `sw.js`.
- Test with Playwright against `python3 -m http.server`, using a phone viewport.
