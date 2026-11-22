export function watchPage(refresh: () => void) {
  let timer: number | undefined;
  const schedule = () => {
    if (timer !== undefined) return;
    timer = window.setTimeout(() => {
      timer = undefined;
      refresh();
    }, 160);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {
    childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ["aria-hidden", "hidden", "inert", "class", "href", "type", "name", "id", "autocomplete", "download"],
  });
  window.addEventListener("hashchange", schedule);
  window.addEventListener("popstate", schedule);
  schedule();
  return () => {
    observer.disconnect();
    window.removeEventListener("hashchange", schedule);
    window.removeEventListener("popstate", schedule);
    clearTimeout(timer);
  };
}
