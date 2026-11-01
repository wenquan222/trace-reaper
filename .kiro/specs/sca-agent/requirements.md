# Trace Reaper requirements

## User story

As a hardware-security researcher, I want to load a capture and run an automated CPA pass so that I can see which key bytes are supported by the traces and export the result.

## Functional requirements

1. The app starts with a synthetic 180 × 420 AES-128 capture.
2. The user can change trace count and noise level, then regenerate the sample.
3. The user can upload a CSV with `plaintext_hex` and numeric sample columns.
4. The agent runs CPA for all 16 AES bytes and all 256 hypotheses.
5. The key grid fills progressively as each byte completes.
6. The plot highlights the sample that produced each byte's winning correlation.
7. The report shows confidence, best byte, strongest margin, and runtime.
8. The user can download a Markdown report.

## Verification requirements

- Synthetic runs compare the recovered key with the locked ground truth.
- Uploaded runs show `NO GROUND TRUTH`.
- The smoke test must recover 16/16 bytes at the default settings.

## Experience requirements

- The agent loop is visible in the UI.
- The app works without a backend.
- The app is responsive on desktop and mobile.
- The run action is disabled while a worker is active.
