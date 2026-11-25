// 小程序原生弹层（showActionSheet / showModal / showToast）的网页替代，全部返回 Promise。
(function (global) {
  var layer = null;
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  function close() { if (layer) { layer.remove(); layer = null } }
  function open(box) {
    close();
    layer = el('div', 'ov');
    layer.appendChild(box);
    layer.addEventListener('click', function (e) { if (e.target === layer) { close(); layer_reject && layer_reject() } });
    document.body.appendChild(layer);
  }
  var layer_reject = null;

  // 操作菜单：items = ['文案', ...]，resolve(index)；点遮罩或取消 → resolve(-1)
  function sheet(items, title) {
    return new Promise(function (resolve) {
      var box = el('div', 'sheet');
      if (title) box.appendChild(el('div', 'sheet-title', esc(title)));
      items.forEach(function (t, i) {
        var b = el('div', 'sheet-item', esc(t));
        b.onclick = function () { close(); resolve(i) };
        box.appendChild(b);
      });
      var c = el('div', 'sheet-item cancel', esc(window.I18N ? I18N.t('取消') : '取消'));
      c.onclick = function () { close(); resolve(-1) };
      box.appendChild(c);
      layer_reject = function () { resolve(-1) };
      open(box);
    });
  }
  // 对话框：o = {title, content, editable, placeholder, confirmText, cancel(默认true), danger}
  // resolve({confirm:true, content}) 或 {confirm:false}
  function modal(o) {
    return new Promise(function (resolve) {
      var box = el('div', 'modal');
      if (o.title) box.appendChild(el('div', 'modal-title', esc(o.title)));
      var inp = null;
      if (o.editable) {
        inp = el('textarea', 'modal-input'); inp.value = o.content || ''; inp.placeholder = o.placeholder || '';
        box.appendChild(inp);
      } else if (o.content) box.appendChild(el('div', 'modal-body', esc(o.content).replace(/\n/g, '<br>')));
      var row = el('div', 'modal-btns');
      if (o.cancel !== false) {
        var c = el('div', 'modal-btn', esc(o.cancelText || (window.I18N ? I18N.t('取消') : '取消'))); c.onclick = function () { close(); resolve({ confirm: false }) }; row.appendChild(c);
      }
      var ok = el('div', 'modal-btn primary' + (o.danger ? ' danger' : ''), esc(o.confirmText || (window.I18N ? I18N.t('确定') : '确定')));
      ok.onclick = function () { var v = inp ? inp.value : ''; close(); resolve({ confirm: true, content: v }) };
      row.appendChild(ok);
      box.appendChild(row);
      layer_reject = function () { resolve({ confirm: false }) };
      open(box);
      if (inp) setTimeout(function () { inp.focus() }, 50);
    });
  }
  var toastTimer = null;
  function toast(msg, ms) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on') }, ms || 1800);
  }
  global.UI = { sheet: sheet, modal: modal, toast: toast, esc: esc, close: close };
})(window);
