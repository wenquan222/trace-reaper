# Trace Reaper — 3 minute demo script

Target length: **2:35–2:50**

## 0:00–0:12 — Cold open

**Screen:** A close crop of the leakage map, then pull back to the full interface.

**Voice:** “This is a power trace. Somewhere inside the noise is a key. The hard part is not running one correlation. The hard part is the loop around it.”

## 0:12–0:32 — Problem

**Screen:** Split view of the input deck, key grid, and report panel.

**Voice:** “Side-channel analysis is a series of decisions: how many traces, which samples, which leakage model, and whether the top candidate is really ahead. Most of that evidence ends up scattered across notebooks and scripts.”

## 0:32–0:55 — Introduce Trace Reaper

**Screen:** Hover the hero, then scroll to the workspace.

**Voice:** “Trace Reaper is an autonomous side-channel analyst that makes that loop visible. It surveys the capture, scans every key hypothesis, verifies the ranking, and writes a field report.”

## 0:55–1:35 — Run the agent

**Screen:** Click `Run analysis`. Let the key grid fill. Show the plot highlights.

**Voice:** “I’m starting with 180 synthetic AES traces at a noise level of 0.85. The agent runs CPA for all 16 bytes and all 256 hypotheses. Each cell updates as a byte resolves. The orange marks are the candidate peaks. The grid fills with the recovered key.”

## 1:35–1:55 — Verification

**Screen:** Zoom into the key footer and report metrics.

**Voice:** “The verification pass checks the recovered key against the locked ground truth. Here it is a full 16 out of 16 match. The report shows confidence, the best byte, the strongest margin, and runtime.”

## 1:55–2:15 — How it works

**Screen:** Cut to a simple diagram: main thread → Web Worker → CPA → key grid.

**Voice:** “The interface is static HTML, CSS, and JavaScript. The analysis runs in a Web Worker. The worker precomputes trace statistics, evaluates every hypothesis, and keeps the top five candidates per byte. Trace data stays in the browser tab.”

## 2:15–2:35 — Kiro workflow

**Screen:** Show the `.kiro/steering` and `.kiro/specs` files in the editor.

**Voice:** “The project is organized around Kiro’s steering and spec workflow. Product and technical steering define the constraints. The spec breaks the agent into requirements, design, and tasks, and the implementation follows that loop.”

## 2:35–2:50 — Close

**Screen:** Return to the completed dashboard, then the Trace Reaper wordmark.

**Voice:** “Trace Reaper turns a pile of traces into an evidence trail. Survey, scan, verify, report. That is the loop.”

## Recording checklist

- Record at 1920 × 1080 or higher.
- Use the default sample, then run once before recording to confirm the browser is responsive.
- Keep the cursor out of the key grid while it is filling.
- Use the final report screenshot at the end.
- Keep the video under 3:00.
- Upload as a public or unlisted YouTube video.
