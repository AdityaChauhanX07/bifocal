import { useEffect, useState } from "react";

interface InstallOffer extends Event {
  prompt(): Promise<unknown>;
}

export function InstallButton() {
  const [offer, setOffer] = useState<InstallOffer | null>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    function offerInstall(event: Event) {
      event.preventDefault();
      setOffer(event as InstallOffer);
      setShowHint(false);
    }

    function installed() {
      setOffer(null);
      setShowHint(false);
    }

    window.addEventListener("beforeinstallprompt", offerInstall);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", offerInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (showHint) return <p className="meta ml-auto" role="status">Use your browser’s install menu.</p>;
  if (!offer) return null;

  return (
    <button className="secondary ml-auto" type="button" onClick={() => {
      setOffer(null);
      void offer.prompt().catch(() => setShowHint(true));
    }}>
      Install Bifocal
    </button>
  );
}
