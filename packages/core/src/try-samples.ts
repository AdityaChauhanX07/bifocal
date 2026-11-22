export const trySamples = [
  { id: "new-number", label: "A text from a new number", text: "Hi, it’s your grandson. My phone broke. Buy a gift card and text me the code. Please don't tell anyone yet." },
  { id: "fraud-alert", label: "A declined card payment", text: "Riverbend Savings declined a card purchase. If it wasn't yours, call the number printed on your card." },
  { id: "locked-account", label: "An account notice", text: "Your account will be locked today. Verify your login immediately at https://account-review.example.test/login to keep access." },
  { id: "remote-support", label: "A support pop-up", text: "We detected a virus. Install the remote support tool now so our technician can fix your computer." },
  { id: "pickup-code", label: "A pickup reminder", text: "Your library hold is ready. Show pickup code 8432 at the front desk when you arrive." },
  { id: "security-code", label: "A security message", text: "This is your account support team. Reply with your one-time code to confirm your identity." },
  { id: "refund-receipt", label: "A refund receipt", text: "Your refund of $24.50 was issued to your original payment method. No action is needed." },
  { id: "wire-payment", label: "A payment request", text: "The vendor changed banks. Wire the payment today to our new account. Keep this between us." },
] as const;

export type TrySampleId = (typeof trySamples)[number]["id"];
