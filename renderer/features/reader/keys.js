// The one-key shortcuts from the prototype. They are ignored while typing in a
// field, where Escape just leaves it. view: { page(), goToPage(n), pageCount,
// store, tabId, toggleSidebar(), focusFind() }.
export function mountKeys(view) {
  function onKeyDown(event) {
    const target = event.target;
    if (target.matches?.('input, select, textarea')) {
      if (event.key === 'Escape') target.blur();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const page = view.page();
    switch (event.key) {
      case 'ArrowRight': case 'PageDown': case 'j': view.goToPage(page + 1); break;
      case 'ArrowLeft': case 'PageUp': case 'k': view.goToPage(page - 1); break;
      case 'Home': view.goToPage(1); break;
      case 'End': view.goToPage(view.pageCount); break;
      case '+': case '=': view.store.stepZoom(view.tabId, 1); break;
      case '-': view.store.stepZoom(view.tabId, -1); break;
      case '0': view.store.setView(view.tabId, { fit: 'width' }); break;
      case '/': view.focusFind(); break;
      case 't': view.toggleSidebar(); break;
      default: return;
    }
    event.preventDefault();
  }

  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
}
