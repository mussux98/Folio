// What fills the window when no document is open.
export function buildEmptyView(folio) {
  const box = document.createElement('div');
  box.className = 'empty';

  const title = document.createElement('h1');
  title.textContent = 'Folio';
  const hint = document.createElement('p');
  hint.textContent = 'Drop a PDF here, or open one to get started.';
  const button = document.createElement('button');
  button.className = 'primary';
  button.textContent = 'Open a PDF…';
  button.addEventListener('click', () => folio.openDialog());

  box.append(title, hint, button);
  return box;
}
