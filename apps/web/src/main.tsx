import { createRoot } from "react-dom/client";
import { judgeDemo } from "./firebase-config";
import "./style.css";
import "./judge.css";

const root = document.getElementById("root");
if (root) {
  const app = createRoot(root);
  if (judgeDemo) root.classList.add("judge-site");
  if (judgeDemo && location.pathname === "/") {
    document.title = "Bifocal | Spot scam warning signs";
    void import("./HomePage").then(({ HomePage }) => app.render(<HomePage />));
  } else if (location.pathname === "/try" || location.pathname === "/try/") {
    document.title = "Check a message | Bifocal";
    void import("./try/TryPage").then(({ TryPage }) => app.render(<TryPage />));
  } else if (location.pathname === "/eval" || location.pathname === "/eval/") {
    document.title = "Held-out evaluation | Bifocal";
    void import("./eval/EvalPage").then(({ EvalPage }) => app.render(<EvalPage />));
  } else {
    document.title = "Trusted contact dashboard | Bifocal";
    void Promise.all([import("./App"), import("./firebase")]).then(([{ App }, { connectFirebase }]) => {
      app.render(<App firebase={connectFirebase()} />);
    });
  }
}
