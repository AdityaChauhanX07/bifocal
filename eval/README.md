# Bifocal evaluation dataset

`dataset.jsonl` contains 80 original synthetic examples for comparing Bifocal's inference paths. It includes 40 scams and 40 legitimate examples across email, SMS, and web pages. Of the legitimate examples, 25 are hard look-alikes, such as fraud alerts, pickup codes, and refund notices.

| Split | Scams | Legitimate | Hard look-alikes |
| --- | ---: | ---: | ---: |
| `prompt` | 8 | 7 | 5 |
| `held_out` | 32 | 33 | 20 |

Each JSONL row has a stable `id`, a `split`, a `channel` (`email`, `sms`, or `web`), and the `text` passed to the model. The evaluation compares the model's output against the expected `tier` and `tactics`. The `hard_lookalike` flag identifies legitimate cases that resemble a scam.

The prompt split includes the six examples already bundled in the screening prompt. Use that split for prompt changes and the 65 held-out samples for reporting. All 14 tactics appear in both splits. The dataset is written in English and uses fictional contacts and reserved domains and numbers. Report results as comparisons on these synthetic examples.

The scenarios draw on public fraud patterns documented by the FTC and FBI. [Phishing](https://consumer.ftc.gov/articles/how-recognize-avoid-phishing-scams) · [Gift cards and money transfers](https://consumer.ftc.gov/consumer-alerts/2023/02/whats-legit-whats-scam) · [Tech support scams](https://www.fbi.gov/how-we-can-help-you/common-frauds-and-scams/tech-support-scams) · [FBI fraud alert](https://www.fbi.gov/image-repository/ic3-fraud-alert.png/view)
