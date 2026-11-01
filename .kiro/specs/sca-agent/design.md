# Trace Reaper design

## Overview

Trace Reaper is a static browser application with a main thread for UI and a Web Worker for CPU-heavy CPA.

## Main thread

Responsibilities:

- Generate the synthetic AES capture.
- Parse uploaded CSV files.
- Render the trace envelope and candidate peaks.
- Manage run state, agent log, and key grid.
- Build and download the Markdown report.

## Worker

Responsibilities:

- Precompute per-sample mean and standard deviation.
- Build a leakage hypothesis for each key guess.
- Compute the correlation sum for every sample.
- Keep the top five candidates for each byte.
- Stream progress back to the main thread.

## Leakage model

The default model is the Hamming weight of the AES S-box output:

```text
hypothesis(byte, guess, plaintext) = HammingWeight(SBOX[plaintext ^ guess])
```

For each candidate, the worker computes Pearson correlation against every sample and keeps the largest absolute value.

## Agent loop

```text
survey -> scan -> verify -> report
```

The UI maps each phase to the status line and agent log. The verify phase uses the runner-up margin and, for synthetic data, the locked ground truth.

## Deployment

The repository is a static site. The same files work on GitHub Pages, Netlify, Vercel, or a local HTTP server.
