# Trace Reaper

**An autonomous side-channel analyst that hunts leakage, one byte at a time.**

Trace Reaper is a browser-native demo for Kiroween 2026. It turns a pile of power traces into a repeatable analysis loop: survey the signal, scan every AES key hypothesis, verify the ranking, and export a field report.

The demo is intentionally self-contained. It ships with a synthetic AES-128 dataset, runs correlation power analysis in a Web Worker, and keeps trace data inside the browser tab.

## Run locally

No build step is required.

```powershell
python serve.py 8080
```

Open `http://localhost:8080`.

## What the agent does

1. **Survey** — measures the trace envelope and signal quality.
2. **Scan** — tests all 256 key hypotheses for each of the 16 AES bytes.
3. **Verify** — ranks candidates by peak absolute correlation and runner-up margin.
4. **Report** — exports a Markdown field report with the recovered key, candidates, and runtime.

The default synthetic dataset uses a fixed ground-truth key so the verification step is visible:

```text
2b7e151628aed2a6abf7158809cf4f3c
```

## CSV input

Upload a CSV with a `plaintext_hex` column and one numeric column per sample:

```csv
plaintext_hex,s0,s1,s2,...
00112233445566778899aabbccddeeff,0.12,0.14,0.11,...
```

The browser reads up to 320 traces and 512 samples per trace. For larger captures, pre-segment the data before uploading.

## Architecture

```text
index.html     layout and controls
styles.css     visual system
app.js         dataset generation, UI state, CSV ingestion, reporting
worker.js      CPA engine and candidate ranking
tests/         Node smoke test for the CPA worker
.kiro/         steering and spec-driven build context
```

The CPA engine uses a fixed AES S-box and a Hamming-weight leakage model. For each byte it evaluates 256 hypotheses, computes correlation against every sample, keeps the top five candidates, and reports the peak correlation plus runner-up margin.

## Verification

```powershell
node tests/smoke.mjs
```

Expected result: `matches: 16` and the fixed ground-truth key above. The worker completes the default 180 × 420 synthetic capture in under a second on the development machine.

## Kiro workspace

The repository includes a `.kiro/` workspace with product steering, technical steering, and a spec for the agent loop. The spec files are the source of truth for the build:

- `.kiro/steering/product.md`
- `.kiro/steering/tech.md`
- `.kiro/specs/sca-agent/requirements.md`
- `.kiro/specs/sca-agent/design.md`
- `.kiro/specs/sca-agent/tasks.md`

## License

MIT. See [LICENSE](LICENSE).
