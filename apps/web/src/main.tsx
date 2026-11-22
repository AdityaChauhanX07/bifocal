import { createRoot } from "react-dom/client";
import { App } from "./App";
import { connectFirebase } from "./firebase";
import "./style.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<App firebase={connectFirebase()} />);
