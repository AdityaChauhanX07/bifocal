import { nextSteps, trySamples } from "@bifocal/core";
import { JudgeHeader } from "./JudgeHeader";

export function HomePage() {
  return (
    <>
      <JudgeHeader page="home" />
      <main className="home-page judge-width" id="main-content">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-intro">
            <h1 id="home-title">Take a moment<br />to <em>check.</em></h1>
            <p>Bifocal helps you spot scam warning signs in emails and texts before you send money or share a code.</p>
            <div className="home-actions">
              <a className="judge-button" href="/try">Try a sample <span aria-hidden="true">→</span></a>
              <a className="judge-link" href="#how-it-works">How it works</a>
            </div>
          </div>
          <figure className="home-example">
            <figcaption>Example check <span className="home-example-tag">Fictional text</span></figcaption>
            <blockquote>{trySamples[0].text}</blockquote>
            <div className="home-example-result">
              <div className="home-result-heading">
                <span className="lenses" aria-hidden="true" />
                <span>Bifocal found warning signs</span>
                <span className="risk" data-tier="high">High risk</span>
              </div>
              <ul>
                <li>Asks you to pay with a gift card and share its code.</li>
                <li>Tells you to keep the request a secret.</li>
              </ul>
              <p>{nextSteps.do_not_pay}</p>
            </div>
          </figure>
        </section>

        <section className="home-steps" id="how-it-works" aria-labelledby="how-title">
          <h2 id="how-title">From a warning to a next step</h2>
          <div className="home-step-grid">
            <article>
              <h3>Check a message</h3>
              <p>Try a fictional email or text. See which words Bifocal flagged and what you can do next.</p>
              <a className="judge-link" href="/try">Open the message checker <span aria-hidden="true">→</span></a>
            </article>
            <article>
              <h3>Pause before paying</h3>
              <p>With the Chrome extension installed, practice stopping at a fictional gift-card checkout.</p>
              <a className="judge-link" href="/demo/checkout.html">Open the practice checkout <span aria-hidden="true">→</span></a>
            </article>
            <article>
              <h3>Use it in Chrome</h3>
              <p>Open Bifocal’s side panel on a Gmail message or an incoming text in Google Messages for web.</p>
              <details>
                <summary>Install the extension</summary>
                <ol>
                  <li><a className="judge-link" href="/downloads/bifocal-chrome.zip" download>Download the ZIP</a> and extract it.</li>
                  <li>Open <code>chrome://extensions</code> and enable <strong>Developer mode</strong>.</li>
                  <li>Choose <strong>Load unpacked</strong> and select the folder with <code>manifest.json</code>.</li>
                </ol>
              </details>
            </article>
          </div>
        </section>
      </main>
      <footer className="home-footer judge-width">
        <p>Pasted messages are checked on this device.</p>
        <a className="judge-link" href="/eval">Explore the evaluation</a>
      </footer>
    </>
  );
}
