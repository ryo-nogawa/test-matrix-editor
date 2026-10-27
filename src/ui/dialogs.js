// ダイアログ（ポップアップ）と、画面下に短く出すお知らせ
const Dialogs = (() => {
  // buttons：[{ label, primary, action(close) }]。action が false を返したときは閉じない
  function open({ title, body, buttons, wide = false }) {
    const dialog = document.createElement('dialog');
    dialog.className = `dialog${wide ? ' wide' : ''}`;

    const heading = Object.assign(document.createElement('h2'), { textContent: title });
    const content = document.createElement('div');
    content.className = 'dialog-body';
    content.append(...[].concat(body));

    const footer = document.createElement('div');
    footer.className = 'dialog-buttons';
    const close = () => {
      dialog.close();
      dialog.remove();
    };
    for (const { label, primary, action } of buttons) {
      const button = Object.assign(document.createElement('button'), { type: 'button', textContent: label });
      if (primary) button.className = 'primary';
      button.addEventListener('click', async () => {
        if ((await action?.()) !== false) close();
      });
      footer.append(button);
    }

    dialog.append(heading, content, footer);
    dialog.addEventListener('cancel', close); // Esc キー
    document.body.append(dialog);
    dialog.showModal();
    return { dialog, close };
  }

  // 見出しと箇条書きだけのダイアログ。kind は 'error' | 'warning' | 'info'
  function message(title, lead, items = [], kind = 'info') {
    const body = [Object.assign(document.createElement('p'), { textContent: lead })];
    if (items.length) {
      const list = document.createElement('ul');
      for (const item of items) list.append(Object.assign(document.createElement('li'), { textContent: item }));
      body.push(list);
    }
    const { dialog } = open({ title, body, buttons: [{ label: '閉じる', primary: true }] });
    dialog.classList.add(kind);
  }

  let toastTimer = null;
  function toast(text) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = Object.assign(document.createElement('div'), { className: 'toast' });
      document.body.append(el);
    }
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 2500);
  }

  return { open, message, toast };
})();
