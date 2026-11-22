import type { GroundingMetadata } from "firebase/ai";

function searchSuggestions(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowed = new Set(["STYLE", "DIV", "SPAN", "P", "A", "SVG", "PATH", "G", "DEFS", "LINEARGRADIENT", "STOP"]);
  for (const node of Array.from(template.content.querySelectorAll("*"))) {
    if (!allowed.has(node.tagName.toUpperCase())) { node.remove(); continue; }
    for (const { name } of Array.from(node.attributes)) {
      if (name.startsWith("on") || !/^(class|style|id|aria-[a-z-]+|href|viewbox|width|height|d|fill|stroke|xmlns|role|offset|stop-color)$/i.test(name)) {
        node.removeAttribute(name);
      }
    }
    if (node instanceof HTMLAnchorElement) {
      const url = URL.parse(node.getAttribute("href") ?? "");
      if (url?.protocol !== "https:" || !["www.google.com", "google.com"].includes(url.hostname)) {
        node.removeAttribute("href");
        continue;
      }
      node.target = "_blank";
      node.rel = "noopener noreferrer";
    }
  }
  const policy = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";
  return `<meta http-equiv="Content-Security-Policy" content="${policy}">${template.innerHTML}`;
}

export function GroundedResult({ text, grounding }: { text: string; grounding: GroundingMetadata }) {
  const sources = grounding.groundingChunks?.map(({ web }) => {
    const url = URL.parse(web?.uri ?? "");
    return url?.protocol === "https:" ? { url, label: web?.title || url.hostname } : null;
  }) ?? [];
  const claims = grounding.groundingSupports?.filter(({ segment }) => segment?.text.trim()) ?? [];

  return (
    <section aria-label="Cloud search result">
      <p className="method">Checked in the cloud with your permission</p>
      <p className="model-text">{text}</p>
      <p>Search results can help, but they are not proof.</p>
      <ul>
        {claims.map(({ segment, groundingChunkIndices }, index) => {
          const citations = [...new Set(groundingChunkIndices)].flatMap((id) => sources[id] ? [sources[id]] : []);
          return citations.length > 0 && (
            <li key={index}>{segment?.text} {citations.map(({ url, label }) => (
              <a key={url.href} href={url.href} target="_blank" rel="noopener noreferrer">{label}</a>
            ))}</li>
          );
        })}
      </ul>
      {grounding.searchEntryPoint?.renderedContent && (
        <iframe title="Google Search suggestions" className="search-suggestions"
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          srcDoc={searchSuggestions(grounding.searchEntryPoint.renderedContent)} />
      )}
    </section>
  );
}
