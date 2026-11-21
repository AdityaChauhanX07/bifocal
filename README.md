# Bifocal

Bifocal helps older adults spot scam warning signs in messages and pause before taking a risky action. It uses Firebase AI Logic to check messages in Chrome, with a cloud check available after the user reviews and approves a redacted copy.

## Shared screening

Run `npm ci`, `npm test`, and `npm run typecheck` with Node.js 22.18 or later.

Use `screenSchema` from `@bifocal/core` as the Firebase response schema and `systemPrompt` as the system instruction. Pass the model's JSON and the exact text it screened to `parseScreening`. If parsing returns `null`, discard that model response. Use `nextSteps` to display the action the model selected.
