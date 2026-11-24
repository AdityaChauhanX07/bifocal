# Bifocal test report

Date: 2026-11-24. Code under test: `f567d3f` (`fix/iss-06-pause-bypass`), one commit ahead of `main` (`dc49dde`).

## Summary

- **Automated:** 97 of 97 tests pass. Typecheck and both builds are clean.
- **Manual (2026-11-23):** 42 recorded checks. 27 PASS, 1 FAIL, 14 NOT RUN.
- **The FAIL (D7, ISS-06) is fixed on the branch but not in the public download.** On 2026-11-24 the hosted ZIP still had SHA-256 `c4965749…`, the build that fails D7.
- **Not tested:** Google Messages SMS, offline Gemini Nano, Gmail on the PUBLIC build, and usability (0 of 5 participants).

## Automated results (run 2026-11-24)

Clean clone, `npm ci`, macOS, Node 24.22.3 unless noted. This closes the "re-run on Node 24" item in `patch-iss06-for-aditya.md`.

| Suite | Command | Result |
| --- | --- | --- |
| Extension `lib` | `npm test` | 7/7 |
| Web | `npm test` | 5/5 |
| Core (redaction, screening) | `npm test` | 48/48 |
| Adapters + trusted-contact summary | `npm test` | 14/14 |
| Cloud Functions | `npm test` in `functions` | 10/10 (Node 24.22.3 and 22.23.2) |
| Firestore rules | Firestore emulator | 11/11 |
| Trusted-contact flow | Auth + Firestore emulators | 2/2 |
| **Total** | | **97/97** |
| Typecheck | `npm run typecheck` | clean |
| Extension build (`WXT_BIFOCAL_JUDGE_DEMO=true`) | `npm run build` | succeeds |
| Web build | `npm run build` | succeeds |

### ISS-06 regression check

`pause.test.ts` was run against both versions of `pause.ts`. For the old version, only an import path was changed so Node could load it.

| Version | Result |
| --- | --- |
| Old (`dc49dde`) | 1 pass, 3 fail |
| Fixed (`f567d3f`) | 4 pass |

The rebuilt `risky.js` (`6e9505c0…`) is byte-identical to the one in the patched build that passed D7-P in real Chrome.

## Manual results (real Chrome 157, 2026-11-23)

| Area | PASS | FAIL | NOT RUN |
| --- | --- | --- | --- |
| A: hosted demo, download, install | A1–A7 | | A8, A9 |
| B: Gmail and offline Nano (PUBLIC) | | | B1–B7 |
| C: Google Messages SMS | | | C1–C4 |
| D: Pause (PUBLIC) | D1–D6 | D7 | |
| D: Pause retest (PATCHED) | D5-P, D6-P, D7-P | | |
| E: trusted contact (SPARK) | E2–E12 | | E1 |

### Limits of this evidence

- D2, E2–E4, E8, E11 and E12 pass on Vladimir's report. No screenshot is saved in `evidence/`. Every evidence file cited in the CSV is present.
- E5 passes on the dashboard side only. The panel's confirmation text was not recorded.
- E10 passes only by keyboard. Mouse clicks on **Send note** were blocked (ISS-05).
- E2 showed **Checked privately on this computer** in Gmail, but on SPARK and not as an offline test. It does not cover B6.
- `test-plan.md` lists B8–B9, C5–C6 and E13–E14, which are not defined in `qa-results.csv`.

## Screening accuracy (held-out set, run 2026-11-23, not rerun)

65 fictional messages: 32 scams, 33 legitimate, of which 20 are hard look-alikes. Both cloud columns were recomputed from `eval/results/cloud.csv` and match `cloud.md`. The Nano column is copied from `on-device.md`; its CSV is not in the repo.

| Metric | Gemini Nano | Cloud, original | Cloud, redacted |
| --- | ---: | ---: | ---: |
| Valid screenings | 61/65 | 65/65 | 65/65 |
| Scams flagged | 29/31 | 32/32 | 32/32 |
| Legitimate marked high risk | 1/30 | 1/33 | 0/33 |
| Hard look-alikes flagged | 6/17 | 1/20 | 0/20 |
| Median latency | 2.70 s | 1.09 s | 0.94 s |
| 95th-percentile latency | 3.38 s | 5.38 s | 10.13 s |

Nano misses its 100% valid-screening target. Counting its invalid scam response as a miss gives 29/32. Latency covers successful attempts only: the cloud runs needed 19 extra attempts, and that time is excluded.

## Open issues

| ID | Severity | Status |
| --- | --- | --- |
| ISS-06: Pause reopens after a full hold | High | Fixed on branch and verified; not merged; public ZIP still affected |
| ISS-05: notice covers **Send note** on `/dashboard` | Medium | Open; `excludeMatches` at `f567d3f` still lists only the message sites |
| ISS-01: PUBLIC and SPARK look identical | Medium | Open |
| ISS-07: page-text change clears the Pause exception | Low–Medium | Open; design decision; shown by unit probe only |
| ISS-03: button label mismatches | Low | Open |
| ISS-04: Spark ZIP untracked in repo root | Low | Open |
| ISS-02: App Check 403 in automated Chrome | Info | Tooling only |

## Next steps, in order

1. Merge `fix/iss-06-pause-bypass`, rebuild and publish the PUBLIC ZIP, then rerun D1–D7 on it.
2. Fix ISS-05, or keep Bifocal out of the contact's profile when recording.
3. Run B1–B7 on PUBLIC, including the offline check (B6).
4. Run C1–C4 (needs an Android phone and a second phone).
5. Finish A8, A9 and E1, and save the missing screenshots.
6. Run the usability sessions (P01–P05).

Not covered by this run: real Chrome, live cloud or Nano inference, phone push, the Chrome smoke build and the judge-demo build.
