import { runCheck } from "./inference.js";

const output = document.querySelector("#output");
const offscreenButton = document.querySelector("#offscreen-button");
const panelButton = document.querySelector("#panel-button");

async function showCheck(run) {
  offscreenButton.disabled = true;
  panelButton.disabled = true;
  output.textContent = "Running Gemini Nano…";

  try {
    const report = await run();
    output.textContent = JSON.stringify(report, null, 2);
  } catch (error) {
    output.textContent = error.message;
  } finally {
    offscreenButton.disabled = false;
    panelButton.disabled = false;
  }
}

offscreenButton.addEventListener("click", () => {
  showCheck(() => chrome.runtime.sendMessage({ type: "request-offscreen-check" }));
});
panelButton.addEventListener("click", () => showCheck(runCheck));
