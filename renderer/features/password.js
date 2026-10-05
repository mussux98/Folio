import { setPassword } from '../commands/password.js';

// File > Password…: sets, changes or removes the password that opens the
// file. It's an edit like any other, written on the next save.
export async function changePassword({ reader, editing }, tabId) {
  const doc = reader.documentOf(tabId);
  if (!doc) return;
  const answer = await askPassword(await doc.engine.isProtected(doc.docId));
  if (answer !== null) await editing.run(tabId, setPassword(doc, answer));
}

// Resolves to the new password, '' to remove it, or null if cancelled.
function askPassword(isProtected) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'busy';
    const box = document.createElement('div');
    box.className = 'busy-box password-dialog';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Password');

    const title = document.createElement('h2');
    title.textContent = isProtected ? 'Change password' : 'Protect with a password';
    const note = document.createElement('p');
    note.className = 'sign-note';
    note.textContent = 'Anyone opening the file will need this password. It takes effect when you save. A lost password cannot be recovered.';

    const field = (text) => {
      const label = document.createElement('label');
      label.textContent = text;
      const input = document.createElement('input');
      input.type = 'password';
      label.append(input);
      return { label, input };
    };
    const first = field('Password');
    const second = field('Confirm');

    const problem = document.createElement('p');
    problem.className = 'sign-note password-problem';
    const actions = document.createElement('div');
    actions.className = 'sign-actions';
    const remove = document.createElement('button');
    remove.textContent = 'Remove password';
    remove.className = 'left';
    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    const ok = document.createElement('button');
    ok.textContent = 'Set password';
    ok.className = 'primary';
    if (isProtected) actions.append(remove);
    actions.append(cancel, ok);

    const password = () => first.input.value;
    function trouble() {
      if (!password()) return ' ';
      if (password().includes(',')) return 'A password cannot contain a comma.';
      if (second.input.value && second.input.value !== password()) return 'The passwords do not match.';
      return second.input.value ? '' : ' ';
    }
    function update() {
      const text = trouble();
      problem.textContent = text.trim();
      ok.disabled = text !== '';
    }
    for (const { input } of [first, second]) {
      input.addEventListener('input', update);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !ok.disabled) close(password());
      });
    }

    function onKey(event) {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      close(null);
    }
    function close(result) {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(result);
    }
    remove.addEventListener('click', () => close(''));
    cancel.addEventListener('click', () => close(null));
    ok.addEventListener('click', () => close(password()));
    document.addEventListener('keydown', onKey, true);

    box.append(title, note, first.label, second.label, problem, actions);
    overlay.append(box);
    document.body.append(overlay);
    update();
    first.input.focus();
  });
}
