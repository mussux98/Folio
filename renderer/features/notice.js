// A short message at the bottom of the window, for hints and for things the
// user should know about an edit. One shows at a time; it hides on its own.
export function createNotice() {
  const el = document.createElement('div');
  el.className = 'notice';
  el.setAttribute('role', 'status');
  el.hidden = true;
  document.body.append(el);
  let timer = 0;

  function hide() {
    clearTimeout(timer);
    el.hidden = true;
  }

  function show(text, ms = 6000) {
    clearTimeout(timer);
    el.textContent = text;
    el.hidden = false;
    timer = setTimeout(hide, ms);
  }

  el.addEventListener('click', hide);
  return { show, hide };
}
