# Technical steering

## Runtime

- Static HTML, CSS, and JavaScript.
- No build step and no framework runtime.
- CPA runs in a dedicated Web Worker.
- The app is deployable to GitHub Pages, Netlify, Vercel, or any static host.

## Data contract

The in-memory dataset is:

```js
{
  plaintexts: Uint8Array, // traceCount * 16
  traces: Float32Array,   // traceCount * sampleCount
  traceCount: number,
  sampleCount: number,
  key: Uint8Array | null,
  source: "synthetic" | "csv"
}
```

## CPA contract

- AES S-box output.
- Hamming-weight leakage model by default.
- 256 hypotheses per byte.
- Peak absolute Pearson correlation across all samples.
- Top five candidates retained per byte.
- Runner-up margin used as a verification signal.

## UI contract

- The main action is always `Run analysis`.
- The agent log is append-only during a run.
- The key grid updates as each byte completes.
- The report button is disabled until a run finishes.
- The layout works at 320 px and above.

## Quality bar

- `node --check` passes for browser scripts.
- `node tests/smoke.mjs` recovers 16/16 bytes on the default synthetic capture.
- No `.env` file, API key, or trace data is committed.
- `.kiro/` stays in the repository.
