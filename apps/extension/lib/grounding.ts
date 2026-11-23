import type { GroundingMetadata } from "firebase/ai";

type Source = { href: string; label: string };

function uniqueSources(sources: Source[]) {
  return [...new Map(sources.map((source) => [source.href, source])).values()];
}

function isolateSuggestions(html: string, page: Document) {
  const template = page.createElement("template");
  template.innerHTML = html;
  if (template.content.querySelector("script, iframe, object, embed, meta, base, form, template, foreignObject, animate, animateMotion, animateTransform, set")) {
    return null;
  }

  const links = [...template.content.querySelectorAll("a[href], area[href], a[xlink\\:href], area[xlink\\:href]")];
  const supported = links.length > 0 && links.every((link) => {
    const url = URL.parse(link.getAttribute("href") ?? link.getAttribute("xlink:href") ?? "");
    return url?.protocol === "https:" && !url.username && !url.password && !url.port &&
      ["www.google.com", "google.com"].includes(url.hostname) && url.pathname === "/search";
  });
  if (!supported) return null;

  // Keep Google's widget intact and limit what its frame can load.
  const policy = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";
  return `<meta http-equiv="Content-Security-Policy" content="${policy}">${html}`;
}

export function prepareGrounding(metadata: GroundingMetadata | undefined, page = document) {
  const indexed = metadata?.groundingChunks?.map(({ web }) => {
    const url = URL.parse(web?.uri ?? "");
    return url?.protocol === "https:" && !url.username && !url.password
      ? { href: url.href, label: web?.title?.trim() || url.hostname } : null;
  }) ?? [];
  const sources = uniqueSources(indexed.filter((source) => source !== null));
  if (!sources.length) return null;

  const html = metadata?.searchEntryPoint?.renderedContent;
  const suggestions = html ? isolateSuggestions(html, page) : null;
  if (html && !suggestions) return null;

  const claims = metadata?.groundingSupports?.flatMap(({ segment, groundingChunkIndices }) => {
    const text = segment?.text?.trim();
    const links = uniqueSources((groundingChunkIndices ?? []).flatMap((index) => {
      const source = indexed[index];
      return source ? [source] : [];
    }));
    return text && links.length ? [{ text, links }] : [];
  }) ?? [];
  const cited = new Set(claims.flatMap(({ links }) => links.map(({ href }) => href)));

  return { claims, otherSources: sources.filter(({ href }) => !cited.has(href)), suggestions };
}

export type GroundedSources = NonNullable<ReturnType<typeof prepareGrounding>>;
