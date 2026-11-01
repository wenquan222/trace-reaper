# Devpost submission draft

## Project

**Trace Reaper**

**Tagline:** An autonomous side-channel analyst that hunts leakage, one byte at a time.

**Category:** Frankenstein

**Short description:** Trace Reaper turns a pile of power traces into a ranked AES key, a confidence view, and a reproducible field report. The agent surveys the signal, scans every key hypothesis, verifies the ranking, and exports the result.

## Inspiration

Side-channel analysis is a loop of small decisions: which traces to keep, which sample window to inspect, which leakage model to test, and whether a candidate is actually ahead of the noise. The tools are often scattered across notebooks, scripts, and plots. Trace Reaper makes that loop visible in one browser tab.

## What it does

Trace Reaper is a browser-native analysis agent for AES-128 power traces.

1. It surveys the trace envelope and reports the capture shape.
2. It runs correlation power analysis for all 16 bytes and all 256 key hypotheses.
3. It ranks candidates by peak absolute correlation and runner-up margin.
4. It fills a 16-byte key grid progressively as each byte resolves.
5. It highlights the sample that produced the strongest candidates.
6. It exports a Markdown field report with the recovered key, candidate table, confidence, and runtime.

The demo starts with a synthetic 180 × 420 capture and a locked ground-truth key. A user can also upload a CSV with `plaintext_hex` plus numeric sample columns.

## How we built it

- Static HTML, CSS, and JavaScript.
- A Web Worker for the CPA engine.
- An AES S-box and Hamming-weight leakage model.
- Correlation power analysis across every sample for every key guess.
- A responsive lab-instrument interface with a live agent log.
- A Node smoke test that verifies the worker recovers 16/16 bytes.

## Kiro usage

Trace Reaper is organized as a Kiro workspace:

- `.kiro/steering/product.md` defines the product principles and audience.
- `.kiro/steering/tech.md` defines the runtime, data contract, and quality bar.
- `.kiro/specs/sca-agent/requirements.md` captures the user stories and acceptance criteria.
- `.kiro/specs/sca-agent/design.md` describes the main-thread/worker split and the CPA loop.
- `.kiro/specs/sca-agent/tasks.md` tracks the build and submission tasks.

The build follows the spec as the source of truth: the agent loop is `survey → scan → verify → report`, and the UI exposes each phase.

## Challenges

The main challenge was making a CPU-heavy analysis loop feel immediate in a browser. The CPA engine precomputes per-sample statistics, reuses a hypothesis buffer, and keeps only the top five candidates per byte. The default capture completes in well under a second on the development machine.

The second challenge was making the result inspectable. A single key string is not enough, so the interface shows per-byte peak correlation, runner-up margin, candidate peaks, and a downloadable report.

## Accomplishments

- A complete browser-only CPA demo with no backend.
- A visible agent loop rather than a black-box button.
- 16/16 byte recovery on the default synthetic capture.
- A report that can be reproduced from the same trace settings.
- A responsive interface that works on desktop and mobile.

## What we learned

The useful unit in side-channel work is not just the final key. It is the evidence trail: which sample, which candidate, which margin, and which run. Trace Reaper makes that trail the product.

## What's next

- Add real capture adapters for common oscilloscope exports.
- Add leakage-model selection with automatic model comparison.
- Add trace alignment and window selection.
- Add a multi-run verification view.
- Add team workspaces for shared capture review.

## Built with

`HTML`, `CSS`, `JavaScript`, `Web Worker`, `AES`, `CPA`, `Kiro`

## Links

- Demo: `{{APP_URL}}`
- Repository: `https://github.com/wenquan222/trace-reaper`
- Video: `{{YOUTUBE_URL}}`
- Blog: `{{BLOG_URL}}`
- Social: `{{SOCIAL_URL}}`

## Judge test path

1. Open the demo URL.
2. Keep the default `180` traces and `0.85` noise.
3. Click `Run analysis`.
4. Watch the key grid fill and the leakage map capture.
5. Confirm `MATCH 16/16 · GROUND TRUTH`.
6. Click `Download report` to inspect the exported evidence trail.

No login is required for the demo.
