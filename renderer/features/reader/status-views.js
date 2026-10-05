// What a tab shows instead of pages: loading, a problem, or a password prompt.

function card(title, text) {
  const box = document.createElement('div');
  box.className = 'status-card';
  const heading = document.createElement('h2');
  heading.textContent = title;
  box.append(heading);
  if (text) {
    const body = document.createElement('p');
    body.textContent = text;
    box.append(body);
  }
  return box;
}

export function buildLoadingView(name) {
  return card('Opening…', name);
}

// buttons: [{ label, onClick, primary }]
export function buildErrorView(name, message, buttons) {
  const box = card(`Can't open ${name}`, message);
  const row = document.createElement('div');
  row.className = 'status-buttons';
  for (const { label, onClick, primary } of buttons) {
    const button = document.createElement('button');
    button.textContent = label;
    if (primary) button.className = 'primary';
    button.addEventListener('click', onClick);
    row.append(button);
  }
  box.append(row);
  return box;
}

// onSubmit(password) resolves to true when the password was right.
export function buildPasswordView(name, onSubmit) {
  const box = card('Password required', `${name} is protected. Enter its password to open it.`);
  const form = document.createElement('form');
  form.className = 'status-buttons';
  const input = document.createElement('input');
  input.type = 'password';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Password');
  const submit = document.createElement('button');
  submit.className = 'primary';
  submit.textContent = 'Open';
  const error = document.createElement('p');
  error.className = 'status-error';
  error.setAttribute('role', 'alert');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!input.value) return;
    submit.disabled = true;
    const ok = await onSubmit(input.value);
    submit.disabled = false;
    if (!ok) {
      error.textContent = 'That password is not correct.';
      input.select();
    }
  });

  form.append(input, submit);
  box.append(form, error);
  queueMicrotask(() => input.focus());
  return box;
}
