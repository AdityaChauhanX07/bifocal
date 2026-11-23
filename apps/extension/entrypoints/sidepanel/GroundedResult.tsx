import type { GroundedSources } from "../../lib/grounding";

function SourceLink({ href, label }: GroundedSources["otherSources"][number]) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{label}</a>;
}

export function GroundedResult({ text, grounding }: { text: string; grounding: GroundedSources }) {
  return (
    <section aria-label="Cloud search result">
      <p className="method">Checked in the cloud with your permission</p>
      <p className="model-text">{text}</p>
      <p>Search results can help, but they are not proof.</p>
      <h2>Sources</h2>
      <ul>
        {grounding.claims.map(({ text: claim, links }, index) => (
          <li key={index}>{claim} {links.map((source) => <SourceLink key={source.href} {...source} />)}</li>
        ))}
        {grounding.otherSources.map((source) => <li key={source.href}><SourceLink {...source} /></li>)}
      </ul>
      {grounding.suggestions && (
        <iframe title="Google Search suggestions" className="search-suggestions"
          sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={grounding.suggestions} />
      )}
    </section>
  );
}
