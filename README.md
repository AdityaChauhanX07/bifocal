# Bifocal

Bifocal helps older adults spot scam warning signs in messages and pause before taking a risky action. It uses Firebase AI Logic to check messages in Chrome, with a cloud check available after the user reviews and approves a redacted copy.

## How hybrid is used

| Task | Firebase AI Logic mode | SDK call |
| --- | --- | --- |
| Check pasted text privately | `ONLY_ON_DEVICE`. Use Gemini Nano when it is ready, with a basic local check as the fallback. | [Web screening](https://github.com/AdityaChauhanX07/bifocal/blob/4cff8f61933524e82fff0d9473a927eaa441eaff/apps/web/src/screening-model.ts#L98) |
| Check a built-in fictional example | `PREFER_ON_DEVICE` when cloud checks are configured and the browser is online. The SDK can use a cloud model if needed. | [Web screening](https://github.com/AdityaChauhanX07/bifocal/blob/4cff8f61933524e82fff0d9473a927eaa441eaff/apps/web/src/screening-model.ts#L98) |
| Recheck a redacted message after approval | `ONLY_IN_CLOUD`. Send the exact preview the user approved. | [Approval handler](https://github.com/AdityaChauhanX07/bifocal/blob/4cff8f61933524e82fff0d9473a927eaa441eaff/apps/web/src/try/TryPage.tsx#L77) · [Web screening](https://github.com/AdityaChauhanX07/bifocal/blob/4cff8f61933524e82fff0d9473a927eaa441eaff/apps/web/src/screening-model.ts#L98) |
| Lead with the clearest warning in a trusted-contact request | `ONLY_ON_DEVICE`. The model can select a warning code, which Bifocal turns into a prewritten sentence. | [Contact summary](https://github.com/AdityaChauhanX07/bifocal/blob/4cff8f61933524e82fff0d9473a927eaa441eaff/apps/extension/trusted-contact/summary.ts#L55) |

The result shows whether it used on-device AI, cloud AI, or the basic check. Install the Chrome extension for Gmail, Google Messages and Pause. The separate Chrome side-panel smoke test returned a valid on-device result while offline. [Extension setup](apps/extension/README.md) · [Offline smoke test](tools/chrome-smoke/README.md)

## Try Bifocal locally

From the repository root with Node.js 24.12 or later, build the web app and serve it with the Firebase Hosting emulator.

```sh
npm ci
npm run build -w "@bifocal/web"
npx firebase-tools@15.37.0 emulators:start --only hosting --project demo-bifocal
```

Open `http://127.0.0.1:5000/try` in desktop Chrome. Select a fictional example and click **Check sample**. To check your own text, choose **Paste a message** and **Check privately**. [Web app setup and cloud configuration](apps/web/README.md#try-bifocal)

## Privacy and App Check

The private check keeps pasted text on the device. When the optional cloud check is enabled, the user can review the redacted text before sending it. Review matters because the redaction rules cover common patterns and can miss identifying details. The web app uses Firebase anonymous sign-in and reCAPTCHA Enterprise App Check for cloud screening. The extension's token endpoint checks a Google sign-in and the configured extension origin. [Cloud setup](apps/web/README.md#enable-hosted-cloud-checks) · [Extension token endpoint](functions/README.md)

## Held-out evaluation

Gemini Nano returned valid screenings for 61 of 65 fictional messages. It flagged 29 of 31 scams with valid results and marked 1 of 30 legitimate messages with valid results as high risk. Median latency for valid rows was 2.70 seconds. Four screenings failed validation, and the two cloud paths still need a live run. [Results and error analysis](eval/results/on-device.md) · [Evaluation setup](eval/README.md) · [User-testing protocol](docs/user-testing.md)

## Shared screening

Run `npm ci`, `npm test`, and `npm run typecheck` with Node.js 24.12 or later.

Use `screenSchema` from `@bifocal/core` as the Firebase response schema and `systemPrompt` as the system instruction. Pass the model's JSON and the exact text it screened to `parseScreening`. If parsing returns `null`, discard that model response. Use `nextSteps` to display the action the model selected.

Use `redactText` with the extracted sender address and any known profile or trusted-contact details. Use the returned text as the consent preview and pass that same text to cloud screening after approval. The redaction rules cover common US address and number formats.
