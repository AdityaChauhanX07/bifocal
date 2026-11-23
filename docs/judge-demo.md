# Judge demo

## Screen a fictional message

1. Open `/try` in desktop Chrome. No Bifocal account is needed.
2. Select **A text from a new number** and click **Check sample**. The result should flag the gift-card request and show what to do. The card labels the method it used.
3. Select **A pickup reminder** and click **Check sample** again to compare with an ordinary message.

## Try Pause

1. Extract the Chrome ZIP, open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**. Select the extracted folder containing `manifest.json`.
2. Return to `/try` and open **Practice Pause with the Chrome extension**. In the Bifocal side panel, open **Settings** and enable website checks. If access is already enabled, choose **Check this tab**.
3. Click **Buy gift card**. Bifocal opens **Let’s pause for a moment** before the page can proceed. Release the hold button early to see it stay open. After a full five-second hold, click **Buy gift card** again. The page shows **Test checkout reached**. Reload the checkout to start over.

## Run the demo locally

Use Node.js 24.12+ with the repository dependencies installed.

```sh
npm run build -w @bifocal/web
npm run zip -w @bifocal/extension
npx firebase-tools@15.37.0 emulators:start --only hosting --project demo-bifocal
```

Open `http://127.0.0.1:5000/try`. The checkout is served at `/demo/checkout.html`. The extension ZIP is in `apps/extension/.output`. These two demo flows work with local screening and the basic fallback. [Extension guide](../apps/extension/README.md)
