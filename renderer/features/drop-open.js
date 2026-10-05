// Dropping files from Explorer anywhere on the window opens them.
const hasFiles = (event) => event.dataTransfer?.types.includes('Files');

export function mountDropOpen(folio) {
  document.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    document.body.classList.add('dropping');
  });

  // relatedTarget is null when the pointer leaves the window.
  document.addEventListener('dragleave', (event) => {
    if (!event.relatedTarget) document.body.classList.remove('dropping');
  });

  document.addEventListener('drop', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    document.body.classList.remove('dropping');
    for (const file of event.dataTransfer.files) {
      const path = folio.pathForFile(file);
      if (path) folio.openFile(path);
    }
  });
}
