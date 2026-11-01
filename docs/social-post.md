# Social posts

## X / Twitter

`#KiroweenHackathon26`

Meet Trace Reaper: an autonomous side-channel analyst that hunts leakage, one byte at a time.

It surveys a capture, scans all 256 AES key hypotheses per byte, verifies the ranking, and exports a field report. The whole loop runs in the browser.

My favorite part of Kiro is the steering + spec workflow: product constraints and technical constraints live next to the build, so the agent loop stays visible from requirements to implementation.

Demo: {{APP_URL}}
Code: https://github.com/wenquan222/trace-reaper

## LinkedIn

`#KiroweenHackathon26`

I built Trace Reaper for Kiroween 2026: a browser-native side-channel analysis agent that turns AES power traces into a ranked key, a confidence view, and a reproducible field report.

The agent runs a four-step loop:

1. Survey the trace envelope.
2. Scan all 256 key hypotheses for each byte.
3. Verify candidates by peak correlation and runner-up margin.
4. Export a Markdown evidence trail.

The demo is static HTML, CSS, and JavaScript, with CPA running in a Web Worker. The default synthetic capture recovers 16/16 bytes.

What I like most about Kiro is the spec-driven workflow. The `.kiro` steering and spec files keep the product constraints, technical contract, and build tasks in one place.

Demo: {{APP_URL}}
Code: https://github.com/wenquan222/trace-reaper
