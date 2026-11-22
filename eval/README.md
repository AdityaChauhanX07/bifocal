# Bifocal evaluation dataset

`dataset.jsonl` contains 80 original synthetic examples for comparing Bifocal's inference paths. It includes 40 scams and 40 legitimate examples across email, SMS, and web pages. Of the legitimate examples, 25 are hard look-alikes, such as fraud alerts, pickup codes, and refund notices.

| Split | Scams | Legitimate | Hard look-alikes |
| --- | ---: | ---: | ---: |
| `prompt` | 8 | 7 | 5 |
| `held_out` | 32 | 33 | 20 |

Each JSONL row has a stable `id`, a `split`, a `channel` (`email`, `sms`, or `web`), and the `text` passed to the model. The evaluation compares the model's output against the expected `tier` and `tactics`. The `hard_lookalike` flag identifies legitimate cases that resemble a scam.

The prompt split includes the six examples already bundled in the screening prompt. Use that split for prompt changes and the 65 held-out samples for reporting. All 14 tactics appear in both splits. The dataset is written in English and uses fictional contacts and reserved domains and numbers. Report results as comparisons on these synthetic examples.

The scenarios draw on public fraud patterns documented by the FTC and FBI. [Phishing](https://consumer.ftc.gov/articles/how-recognize-avoid-phishing-scams) · [Gift cards and money transfers](https://consumer.ftc.gov/consumer-alerts/2023/02/whats-legit-whats-scam) · [Tech support scams](https://www.fbi.gov/how-we-can-help-you/common-frauds-and-scams/tech-support-scams) · [FBI fraud alert](https://www.fbi.gov/image-repository/ic3-fraud-alert.png/view)

## Held-out runner

[On-device benchmark and error analysis](results/on-device.md) from the first completed Gemini Nano run.

Open `/eval` in the dashboard. Choose a path and select **Run selected paths**. Model outputs are scored against the labels on all 65 held-out rows. The page calls each model in its requested mode and keeps failed runs, malformed responses, and responses from the wrong source out of its accuracy and median-latency calculations. The valid row count shows coverage. The valid JSON column counts schema-valid results among responses from the requested source. Expand the look-alike alarms to see the individual examples and the warning signs the model reported.

- **On-device.** Use the Chrome profile where Gemini Nano is already installed. The runner uses the original synthetic text.
- **Cloud, original text.** Use the Firebase anonymous sign-in and App Check configuration described in the [web app README](../apps/web/README.md#enable-hosted-cloud-checks). This comparison sends only the bundled fictional examples.
- **Cloud, redacted text.** Uses the same cloud model after the shared redaction step. Each cloud path can make 65 requests and takes at least six and a half minutes at the project's 10-request-per-minute setting.

Stop a run to export partial results or resume from the first unchecked row. **Download CSV** writes attempted row IDs, labels, predictions, source, status, and latency for comparison. The CSV excludes original message text and quotes. Export before closing or reloading the page.

Run the separate local check for 20 planted personal-data values from the repository root.

```sh
node --test packages/core/test/redaction-leaks.test.ts
```

### Run on this computer

From the repository root, with Node.js 24.12 or newer, build and start the local Hosting emulator.

```powershell
npm run build -w "@bifocal/web"
npx firebase-tools@15.37.0 emulators:start --only hosting --project demo-bifocal
```

1. Open `http://127.0.0.1:5000/eval` in the same desktop Chrome profile that passed the Gemini Nano check.
2. Leave **On-device** selected and click **Run selected paths**. Keep the tab open while the 65 rows run.
3. When the run finishes, click **Download CSV**. Press **Ctrl+C** in the emulator terminal when you’re done. Cloud runs require the separate Firebase configuration above.
