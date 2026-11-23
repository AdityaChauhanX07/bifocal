export function JudgeHeader({ page }: { page: "home" | "try" | "eval" }) {
  return (
    <header className="judge-header">
      <a className="judge-skip" href="#main-content">Skip to content</a>
      <div className="judge-width judge-header-row">
        <a className="judge-brand" href="/" aria-label="Bifocal home">
          <span aria-hidden="true" className="lenses" />Bifocal
        </a>
        <nav aria-label="Main navigation">
          <a href="/try" aria-current={page === "try" ? "page" : undefined}>Try a message</a>
          <a href="/eval" aria-current={page === "eval" ? "page" : undefined}>Evaluation</a>
          <a className="judge-header-download" href="/downloads/bifocal-chrome.zip" download>Download for Chrome</a>
        </nav>
      </div>
    </header>
  );
}
