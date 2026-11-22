import { createRoot } from "react-dom/client";
import { App } from "./App";
import { connectFirebase } from "./firebase";
import "./style.css";

const root = document.getElementById("root");
if (root) {
  const app = createRoot(root);
  if (location.pathname === "/try" || location.pathname === "/try/") {
    document.title = "Check a message | Bifocal";
    void import("./try/TryPage").then(({ TryPage }) => app.render(<TryPage />));
  } else {
    app.render(<App firebase={connectFirebase()} />);
  }
}
