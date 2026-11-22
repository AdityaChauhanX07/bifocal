import type { User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { useEffect, useState } from "react";
import { disablePush, enablePush, pushIsEnabled, pushIsSupported } from "./push";

export function PushNotifications({
  db, user, disabled, onBusyChange,
}: { db: Firestore; user: User; disabled: boolean; onBusyChange: (busy: boolean) => void }) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(() => pushIsEnabled(db, user.uid));
  const [changing, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void pushIsSupported().then((available) => { if (active) setSupported(available); }).catch(() => {});
    return () => { active = false; };
  }, []);

  async function toggle() {
    setBusy(true);
    onBusyChange(true);
    setMessage("");
    try {
      if (enabled) {
        await disablePush(db, user.uid);
        setEnabled(false);
      } else {
        const allowed = await enablePush(db, user);
        setEnabled(allowed);
        if (!allowed) setMessage("Notifications are blocked. You can allow them in your browser’s site settings.");
      }
    } catch {
      setMessage("Bifocal couldn’t update notifications. Check your connection and try again.");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  if (!supported) return null;
  return (
    <div className="account">
      <button className="secondary" onClick={() => void toggle()} disabled={disabled || changing}>
        {enabled ? "Turn off notifications" : "Allow notifications"}
      </button>
      {message && <p className="meta" role="status">{message}</p>}
    </div>
  );
}
