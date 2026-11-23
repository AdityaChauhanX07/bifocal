# Held-out inference comparison

On November 23, 2026, the cloud evaluation ran Gemini 3.5 Flash-Lite through Firebase AI Logic and the Gemini Developer API with anonymous Firebase Auth and reCAPTCHA Enterprise App Check. The project was on Spark with billing disabled. A browser-local build in Chromium 153 used the web app's model configuration, shared redaction, and evaluation runner. [Web model configuration](../../apps/web/src/screening-model.ts) · [Evaluation runner](../../apps/web/src/eval/runner.ts)

The dataset contains 32 fictional scams and 33 fictional legitimate messages, including 20 hard look-alikes. The original-text path ran first. The second path applied Bifocal's redaction step, which changed 16 of the 65 inputs. The comparison includes the earlier desktop Chrome run of Gemini Nano on the same held-out rows. [Dataset](../dataset.jsonl) · [Gemini Nano results](on-device.md)

| Metric | Gemini Nano | Cloud, original text | Cloud, redacted text |
| --- | ---: | ---: | ---: |
| Valid screenings | 61/65 (93.8%) | 65/65 (100%) | 65/65 (100%) |
| Scams flagged as suspicious or high | 29/31 (93.5%) | 32/32 (100%) | 32/32 (100%) |
| Legitimate messages marked high risk | 1/30 (3.3%) | 1/33 (3.0%) | 0/33 (0%) |
| Hard look-alikes marked suspicious or high | 6/17 | 1/20 | 0/20 |
| Exact risk-tier agreement | 53/61 (86.9%) | 62/65 (95.4%) | 63/65 (96.9%) |
| Median latency | 2.70 s | 1.09 s | 0.94 s |
| 95th-percentile latency (nearest rank) | 3.38 s | 5.38 s | 10.13 s |

Accuracy and latency use valid screenings from the requested source. Counting the invalid Nano scam screening as a miss gives 29/32 (90.6%) scam catch. Both cloud paths passed schema and evidence validation on all final responses. [Cloud row-level CSV](cloud.csv)

The original-text path returned 55 valid screenings on the first attempt and the redacted path returned 60. The 19 extra attempts followed one per-minute quota response, two HTTP 500 responses, and 16 attempts that ended without an HTTP response. Requests started at least 6.2 seconds apart initially and at least 8 seconds apart after the quota response. Latency measures each valid attempt, excluding pacing, backoff, and prior attempts. [Firebase AI Logic quotas](https://firebase.google.com/docs/ai-logic/quotas)

## Error analysis

Both cloud paths flagged every labeled scam. The only cloud false high was `bf-019`, a legitimate bank message with a sign-in code for an action the recipient had just initiated. Gemini flagged credential collection and secrecy on the original text. The redacted variant replaced the code with a tag and received a `none` verdict.

Three paired risk tiers differed. On `bf-052`, the redacted court impersonation rose from suspicious to high. On `bf-066`, the property-office impersonation fell from high to suspicious with identical text, showing that repeated calls can vary. Gemini rated the suspicious prize notice `bf-070` high in both cloud paths.
