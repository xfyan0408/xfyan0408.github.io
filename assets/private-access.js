(() => {
  "use strict";

  const entry = document.querySelector('.private-entry a');
  if (!entry) return;
  const isGate = document.body.hasAttribute('data-private-gate');
  const destination = new URL(entry.href);
  if (isGate) destination.hash = window.location.hash;
  const home = new URL('../', destination);
  const dialog = document.createElement('dialog');
  dialog.className = 'access-dialog';
  dialog.setAttribute('aria-labelledby', 'access-title');
  dialog.setAttribute('aria-describedby', 'access-description');
  dialog.innerHTML = `
    <button class="access-close" type="button" aria-label="关闭密码窗口">×</button>
    <h2 id="access-title">具象化</h2>
    <p id="access-description" class="access-description">输入密码后查看。</p>
    <form id="password-form" class="password-form" novalidate>
      <label for="password">访问密码</label>
      <div class="password-field">
        <input id="password" name="password" type="password" placeholder="请输入密码" autocomplete="current-password" spellcheck="false" autocapitalize="none" aria-describedby="password-error" required autofocus>
        <button class="password-toggle" type="button" aria-label="显示密码" aria-pressed="false">显示</button>
      </div>
      <p id="password-error" class="form-error" role="alert" aria-live="polite"></p>
      <button class="primary-button" type="submit">解锁</button>
    </form>`;
  document.body.append(dialog);

  const form = dialog.querySelector('form');
  const password = dialog.querySelector('input');
  const error = dialog.querySelector('.form-error');
  const submit = dialog.querySelector('[type="submit"]');
  const toggle = dialog.querySelector('.password-toggle');
  let payloadPromise;
  let attempt = 0;
  let navigating = false;
  let previousOverflow = '';

  function loadPayload() {
    if (window.nanakiPrivatePayload) return Promise.resolve(window.nanakiPrivatePayload);
    if (!payloadPromise) {
      payloadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL('payload.js', destination).href;
        script.onload = () => {
          if (window.nanakiPrivatePayload) resolve(window.nanakiPrivatePayload);
          else { script.remove(); reject(new Error('Missing encrypted data')); }
        };
        script.onerror = () => { script.remove(); reject(new Error('Cannot load encrypted data')); };
        document.head.append(script);
      }).catch(error => { payloadPromise = null; throw error; });
    }
    return payloadPromise;
  }

  function resetForm() {
    form.reset();
    password.type = 'password';
    password.removeAttribute('aria-invalid');
    error.textContent = '';
    toggle.textContent = '显示';
    toggle.setAttribute('aria-label', '显示密码');
    toggle.setAttribute('aria-pressed', 'false');
    submit.disabled = false;
    submit.textContent = '解锁';
  }

  function openDialog() {
    if (dialog.open) return;
    attempt += 1;
    resetForm();
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    dialog.showModal();
    password.focus();
    loadPayload().catch(() => {});
  }

  function showError(message) {
    error.textContent = message;
    password.setAttribute('aria-invalid', 'true');
    password.focus();
  }

  entry.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    openDialog();
  });
  dialog.querySelector('.access-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => {
    attempt += 1;
    resetForm();
    document.documentElement.style.overflow = previousOverflow;
    if (navigating) return;
    if (isGate) window.location.replace(home.href);
    else entry.focus();
  });
  toggle.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    toggle.textContent = show ? '隐藏' : '显示';
    toggle.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
    toggle.setAttribute('aria-pressed', String(show));
  });
  password.addEventListener('input', () => {
    error.textContent = '';
    password.removeAttribute('aria-invalid');
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    if (!password.value) { showError('请输入访问密码。'); return; }
    if (!window.crypto?.subtle) { showError('请通过 HTTPS 或本地预览地址打开本页。'); return; }
    const currentAttempt = ++attempt;
    submit.disabled = true;
    submit.textContent = '正在解锁…';
    try {
      const payload = await loadPayload();
      if (!dialog.open || currentAttempt !== attempt) return;
      const decryptor = payload.initiator.init(payload.config, {
        rememberExpirationKey: 'nilhil_expiration',
        rememberPassphraseKey: 'nilhil_passphrase',
        clearLocalStorageCallback: null,
        replaceHtmlCallback: html => {
          if (!dialog.open || currentAttempt !== attempt) return;
          navigating = true;
          password.value = '';
          document.documentElement.style.overflow = previousOverflow;
          dialog.close();
          if (window.location.href !== destination.href) window.history.pushState(null, '', destination.href);
          document.open();
          document.write(html);
          document.close();
        },
      });
      const result = await decryptor.handleDecryptionOfPage(password.value, false);
      if (!result.isSuccessful && dialog.open && currentAttempt === attempt) showError('密码不正确，请重试。');
    } catch {
      if (dialog.open && currentAttempt === attempt) showError('暂时无法解锁，请重试。');
    } finally {
      if (!navigating && currentAttempt === attempt) {
        submit.disabled = false;
        submit.textContent = '解锁';
      }
    }
  });
  if (isGate) openDialog();
})();
