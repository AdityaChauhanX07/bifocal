# Gemini Nano held-out results

One run of `/eval` in desktop Chrome screened all 65 held-out fictional messages. The export reported `on-device` as the inference source for every row. The dataset contains 32 scams and 33 legitimate messages, including 20 legitimate hard look-alikes. Both cloud evaluation paths still need a live run. [Dataset](../dataset.jsonl) · [Runner used for this run](https://github.com/AdityaChauhanX07/bifocal/blob/4cff8f61933524e82fff0d9473a927eaa441eaff/apps/web/src/eval/runner.ts)

| Metric | On-device result |
| --- | ---: |
| Valid screenings | 61/65 (93.8%) |
| Scams flagged as suspicious or high | 29/31 (93.5%) |
| Legitimate messages marked high risk | 1/30 (3.3%) |
| Hard look-alikes marked suspicious or high | 6/17 |
| Exact risk-tier agreement | 53/61 (86.9%) |
| Median latency | 2.70 s |
| 95th-percentile latency (nearest rank) | 3.38 s |

Accuracy and latency use valid rows. Counting the invalid scam response as a miss gives 29/32 (90.6%) scam catch. Counting every invalid response as tier disagreement gives 53/65 (81.5%) tier agreement. The run met the targets for scam catch, false high risk, and tier agreement. It missed the target of 100% valid screenings. The first row took 12.70 seconds.

The CSV contains verdicts and status codes. It omits raw responses, so it cannot show which validation rule rejected a row. Its SHA-256 is `76ded1c2a781619ad4f63f2c13cb76547de3ab5e56be1cb30dc5e47f5c75be66`.

## Missed scams and invalid responses

| ID | Result | What the message did |
| --- | --- | --- |
| `bf-044` | Rated none | The prize notice directed the recipient to call a claim desk before a same-day deadline. |
| `bf-052` | Rated none | The court impersonation used an unfamiliar link and threatened to record a failure to appear. |
| `bf-020` | Invalid response | The bank impersonation asked for a password and one-time code on a site with a mismatched domain. |
| `bf-025` | Invalid response | A familiar contact asked for a ride from swim practice. |
| `bf-029` | Invalid response | A county notice directed the recipient to the portal listed on their paper assessment. |
| `bf-047` | Invalid response | A store sent a receipt for gift cards already purchased and activated at checkout. |

## Legitimate look-alikes flagged

| ID | Result | What the message did |
| --- | --- | --- |
| `bf-017` | Suspicious | A card lock alert directed the recipient to the bank app they already use or the number on the card. |
| `bf-019` | High | A bank sent a sign-in code for the app where the user had just signed in. The model flagged credential collection and secrecy after the message told the recipient to keep the code private. |
| `bf-021` | Suspicious | A signed-in fraud center directed the customer to Activity or the number on their card. |
| `bf-033` | Suspicious | A store's sign-in page asked the customer to enter a code they had requested in that window. |
| `bf-043` | Suspicious | A scheduled wire was paused. The alert told the customer to call the number on their card if they had not scheduled it. |
| `bf-055` | Suspicious | A partner asked the recipient to call the restaurant using a previous reservation number. The deposit had already been paid. |

The standalone redaction test found that none of the 20 planted values survived as exact text. That result covers only the planted values. [Redaction test](../../packages/core/test/redaction-leaks.test.ts)
