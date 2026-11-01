# Kiro session guide

Use this guide when opening the repository in Kiro. The goal is to produce an honest, repeatable Kiro usage record for the Devpost submission.

## Open the workspace

1. Open Kiro.
2. Choose `Open Folder`.
3. Select the `trace-reaper` folder.
4. Confirm that `.kiro/steering/product.md` and `.kiro/steering/tech.md` are visible.

## Review the spec

Ask Kiro to read:

- `.kiro/specs/sca-agent/requirements.md`
- `.kiro/specs/sca-agent/design.md`
- `.kiro/specs/sca-agent/tasks.md`

Then ask for a short review of `worker.js` against the CPA contract in the design file.

## Run the verification

Ask Kiro to run:

```powershell
node tests/smoke.mjs
```

Expected result:

```text
matches: 16
recovered: 2b7e151628aed2a6abf7158809cf4f3c
```

## Record the session

Capture a screenshot or short clip showing:

1. The `.kiro` workspace open in Kiro.
2. The spec review.
3. The smoke test result.

Use that material in the Devpost `Kiro usage` field and the demo video.
