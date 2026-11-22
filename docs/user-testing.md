# Bifocal user-testing guide

Run a 15-minute session with each of 3 to 5 adults aged 65 or older. The goal is to see whether people understand the warning, know how to respond at Pause, and understand what they share with a trusted contact.

## Set up the demo

Use a Chrome demo profile with fictional messages, a test payment page, and two test accounts. One account belongs to the person using Bifocal. The other is their linked trusted contact. Sign in to the contact dashboard in a separate browser session so you can send a reply when the participant asks for help.

Before inviting anyone to a full session, walk through all three tasks in order.

1. Open the fictional gift-card message below and confirm that the extension shows a warning and a next step.
2. Open the project’s fictional payment page, follow the demo action that triggers Pause, and check that the panel offers a way back.
3. Open **Ask my trusted contact** from the risk card. Check that the preview appears, the request reaches the test contact, and the reply appears on the original card. [Trusted-contact component and test](../apps/extension/trusted-contact/README.md)

Use the app with demo data throughout. If Pause or trusted-contact sharing is still being integrated, you can rehearse the warning task with `/try`. Record it as a `/try` rehearsal. For a participant session, mark any unavailable task as **Blocked** so the notes show what the participant had a chance to try.

### Rehearse the warning task locally

If the local Hosting preview is running, open `http://127.0.0.1:5000/try`. To start it from the repo root, use Node.js 24.12 or newer and run:

```powershell
npm run build -w "@bifocal/web"
npx firebase-tools@15.37.0 emulators:start --only hosting --project demo-bifocal
```

Select **A text from a new number**, then **Check sample**. The warning should flag the gift-card request and advise against sending money or payment details. If the card says **Basic check only**, record that source in the notes.

## Start the session

> Thanks for trying Bifocal. We’re testing the app. All the messages, pages, and accounts today are for the demo. You can skip any task or stop at any point. I’d like to write down how the tasks go and what you find confusing, using a participant number. Is that okay?

Ask separately before saving an anonymous quote for the project page, demo video, or write-up. Take notes under an ID such as `P01`. Keep names, contact information, and identifiable details out of the shared notes. Keep individual notes private and publish only aggregate results and approved quotes.

## Tasks

Read the prompt in each row. Start timing when the participant has heard it and the screen is ready. Let them think aloud. If they get stuck, ask “What would you try next?” and record any help you give.

| Task | Read to the participant | Record |
| --- | --- | --- |
| 1. Understand a warning | “Suppose you got this message. Read the message and Bifocal’s warning. What do you think is happening? What would you do next?” | Whether they identified the gift-card request as the warning sign and said they’d stop, avoid sending a code or money, or check with someone through a number they trust. Record the time and any help. |
| 2. Respond to Pause | “Imagine you’ve reached this checkout page. Bifocal has interrupted you. Show me what you’d do now and tell me why.” | Their first choice, such as **Go back**, **Ask**, or continuing past the warning. Record why they chose it, the time, and any help. |
| 3. Ask a trusted contact | “You’d like a second opinion. Use Bifocal to ask someone you trust for help. Before you send it, tell me what you think they’ll see.” | Whether they found the preview and understood that the contact receives a short summary and warning signs. Record whether the request went through, whether they noticed the reply, the time, and any help. |

For Task 1, use this fictional message in the test inbox and the matching built-in sample in `/try` for rehearsal.

> Hi, it’s your grandson. My phone broke. Buy a gift card and text me the code. Please don't tell anyone yet.

For Task 2, have the demo payment page ready before handing over. Use dummy values if the demo needs any typed input. For Task 3, reply from the test contact dashboard with **Don’t respond. I’ll call you.** Wait for the participant to find it on the original card.

## Session notes

Record the outcome as **Unaided**, **With help**, **Skipped**, or **Blocked**. Use **Blocked** when a feature or the test environment prevented the attempt. After the three tasks, ask “What was most confusing?” and “What would you expect to happen next?” Copy the rows below for each session.

Participant ID and build commit go in the session header. Record the inference source shown on the warning card and whether the session used the extension or `/try`.

| Task | Outcome | Time (s) | What they said or did | Confusion or help given |
| --- | --- | ---: | --- | --- |
| Understand a warning |  |  |  |  |
| Respond to Pause |  |  |  |  |
| Ask a trusted contact |  |  |  |  |

## Write up the results

Report the number of sessions and attempts per task, how many people explained the warning, how many chose **Go back** or **Ask**, and how many found and understood the sharing preview and reply. Include completion times and recurring wording issues. Note any blocked tasks and report `/try` rehearsals separately. Use an approved anonymous quote only if it reflects what a participant actually said.
