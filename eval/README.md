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

See the [three-path comparison](results/cloud.md) and the [on-device error analysis](results/on-device.md).

Open `/eval` in the dashboard. Choose a path and select **Run selected paths**. Model outputs are scored against the labels on all 65 held-out rows. Accuracy and median latency use results that passed validation and came from the requested source. The valid row count shows coverage. The valid screening column shows how many responses from the requested source passed both the schema and evidence checks. Expand failed rows to see why a check failed, or open the look-alike alarms to review the warning signs the model reported.

- **On-device.** Use the Chrome profile where Gemini Nano is already installed. The runner uses the original synthetic text.
- **Cloud, original text.** Use a non-judge build with Firebase anonymous sign-in and App Check on an authorized HTTPS origin. This comparison sends only the bundled fictional examples. [Firebase web setup](../apps/web/README.md#enable-hosted-cloud-checks)
- **Cloud, redacted text.** Uses the same cloud model after the shared redaction step. The runner spaces cloud requests by at least 6.1 seconds. Allow at least six and a half minutes per path, plus time for Firebase quota backoffs.

Stop a run to export partial results or resume from the first unchecked row. **Download CSV** writes attempted row IDs, labels, predictions, source, status, latency, and a `validation_issue` code where available. The CSV excludes raw responses, original message text, and quotes. Export before closing or reloading the page.

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
