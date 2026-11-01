# Product steering

## Product

Trace Reaper is a browser-native side-channel analysis agent. It turns raw power traces into a ranked key hypothesis, a confidence view, and a reproducible field report.

## Audience

- Hardware-security researchers who need a fast first-pass CPA workflow.
- Students learning how leakage models, correlation, and candidate ranking fit together.
- Judges who need to understand the agent loop in under three minutes.

## Product principles

1. **Show the loop.** Every run makes survey, scan, verify, and report visible.
2. **Keep the data local.** The demo uses a Web Worker and never sends traces to a server.
3. **Make the result inspectable.** Each byte exposes its top candidate, peak correlation, and runner-up margin.
4. **Prefer a complete demo over a large surface.** One polished analysis path beats a half-built platform.
5. **Use honest verification.** Synthetic data has a locked ground truth; uploaded data is marked as having no ground truth.

## Hackathon frame

Kiroween 2026, Frankenstein category: stitch a leakage survey, a CPA engine, a verification pass, and a report writer into one agent.

## Out of scope for this build

- Live oscilloscope control.
- Multi-board calibration.
- Server-side storage.
- A general-purpose LLM chat interface.
