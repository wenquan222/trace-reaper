# Building Trace Reaper: an agentic first pass for side-channel analysis

*Written for the Kiroween 2026 hackathon.*

Side-channel analysis has a rhythm. You capture traces, inspect the signal, choose a leakage model, test hypotheses, and then decide whether the candidate in front of you is real. The final key is only one part of the work. The evidence trail is the other part.

Trace Reaper is a browser-native agent for that first pass. It takes a set of AES power traces and runs a visible loop: survey, scan, verify, report.

## The loop

The interface starts with a synthetic AES-128 capture. The default is 180 traces with 420 samples each and a noise level of 0.85. The ground-truth key is locked so the verification step has something concrete to compare against.

When you press `Run analysis`, the agent does four things.

First, it surveys the trace envelope. This is the quick shape check: how much the signal moves, where the envelope is stable, and what the capture looks like before a hypothesis enters the picture.

Second, it scans. For each of the 16 AES key bytes, the worker evaluates all 256 hypotheses. It builds a Hamming-weight leakage model from the AES S-box output, computes Pearson correlation against every sample, and keeps the largest absolute value for each candidate.

Third, it verifies. The winning candidate for each byte is ranked against the runner-up. The gap between them becomes a margin signal. On the synthetic capture, the agent also checks the recovered key against the locked ground truth.

Fourth, it reports. The field report includes the recovered key, the top five candidates per byte, peak correlation, margin, sample index, confidence, and runtime.

## Why the browser

A browser demo is a useful constraint. The analysis has to be fast, the state has to be visible, and the result has to be understandable without a terminal.

The CPA engine runs in a Web Worker. That keeps the interface responsive while the CPU-heavy loop runs. The worker precomputes per-sample mean and standard deviation, reuses a hypothesis buffer, and keeps only the top five candidates for each byte. In the default capture, it recovers 16 out of 16 bytes in well under a second on the development machine.

The trace data stays in the browser tab. The app is static HTML, CSS, and JavaScript, so it can be deployed to any static host.

## Making the evidence visible

The key grid is the center of the experience. Each cell fills as a byte resolves. The cell shows the recovered byte and the peak correlation. The leakage map marks the samples that produced the strongest candidates. The report turns the same run into a file that can be reviewed later.

That combination matters for research work. A single key string is easy to copy and hard to audit. A candidate table with margins and sample indices gives the next person something to inspect.

## Kiro workflow

Trace Reaper is organized as a Kiro workspace. The `.kiro/steering` directory holds the product and technical constraints. The `.kiro/specs/sca-agent` directory holds the requirements, design, and task list.

The spec is deliberately small:

```text
survey -> scan -> verify -> report
```

That loop drives the interface, the worker contract, and the report format. The product steering keeps the build focused on one complete analysis path. The technical steering keeps the runtime static and the trace data local.

## What comes next

The next step is to connect the same agent loop to real capture formats. After that, the interesting work is model comparison: let the agent try multiple leakage models, compare their margins, and explain which model the evidence supports.

Trace Reaper is a first pass, but it is a complete first pass. It turns a pile of traces into a visible, reproducible evidence trail.
