// 页面层 · 网页版。小程序的 9 个页面 → hash 路由 + 字符串模板渲染。业务逻辑全部在 store.js。
(function () {
  var h = UI.esc;
  var $view = document.getElementById('view');
  var $title = document.getElementById('navtitle');
  var $back = document.getElementById('back');
  var $tabbar = document.getElementById('tabbar');
  var ORDER = { '在建': 0, '等CO': 1, '在售': 2 };
  var TAB_ROUTES = ['sites', 'today', 'diary', 'calendar', 'settings'];
  var state = { sitesView: 'list', exp: {}, cal: null, diaryFilter: 'all', archOpen: false, depth: 0 };

  // 首次打开：没有数据就灌示例数据
  if (!S.hasData()) S.replaceAll(DEMO.build(S));

  // ---------- 路由 ----------
  function parseHash() {
    var hsh = location.hash.replace(/^#\/?/, '') || 'sites';
    var q = {}; var qi = hsh.indexOf('?');
    if (qi >= 0) {
      hsh.slice(qi + 1).split('&').forEach(function (kv) { var p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '') });
      hsh = hsh.slice(0, qi);
    }
    return { parts: hsh.split('/'), q: q };
  }
  function go(hash) { state.depth++; location.hash = hash }
  function back(fallback) {
    if (state.depth > 0) { state.depth--; history.back() } else location.hash = fallback || '#/sites';
  }
  function qs(o) { return Object.keys(o).filter(function (k) { return o[k] != null && o[k] !== '' }).map(function (k) { return k + '=' + encodeURIComponent(o[k]) }).join('&') }
  function setNav(title, tab, showBack) {
    $title.textContent = title;
    $back.hidden = !showBack;
    $tabbar.hidden = !tab;
    Array.prototype.forEach.call($tabbar.querySelectorAll('a'), function (a) { a.classList.toggle('on', a.dataset.tab === tab) });
  }
  function render() {
    var r = parseHash(); var p = r.parts; var q = r.q;
    $view.scrollTop = 0;
    switch (p[0]) {
      case 'sites': return pageSites();
      case 'site': return pageNewSite();
      case 'timeline': return pageTimeline(p[1]);
      case 'today': return pageToday();
      case 'calendar': return pageCalendar();
      case 'diary': return p[1] ? pageDiaryEdit(p[1], q) : pageDiary();
      case 'settings': return pageSettings();
      case 'task':
        if (p[1] === 'new') return pageTaskEdit(null, q, false);
        return pageTaskEdit(p[1], q, p[2] === 'date');
      default: location.hash = '#/sites';
    }
  }
  window.addEventListener('hashchange', render);

  // 事件委托：data-act="名字" + data-* 参数
  var ACT = {};
  $view.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el || !$view.contains(el)) return;
    var fn = ACT[el.dataset.act]; if (!fn) return;
    e.stopPropagation(); fn(el.dataset, el, e);
  });
  $back.addEventListener('click', function (e) { e.preventDefault(); back($back.getAttribute('href')) });

  // ---------- 公共：任务操作菜单（移植自 store.showTaskMenu） ----------
  function taskMenu(id, rebuild) {
    var d = S.load(); var t = S.getTask(d, id); if (!t) return;
    var items;
    if (t.st === 'done') items = ['恢复为未完成'];
    else {
      items = ['标为已完成', '修改日期'];
      items.push(t.st === 'wait' ? '恢复为待办' : '转为挂起 · 等待中');
      items.push('编辑详情', '删除');
    }
    UI.sheet(items, t.name).then(function (i) {
      if (i < 0) return;
      var it = items[i];
      if (it === '恢复为未完成') { S.reopenTask(id); rebuild() }
      else if (it === '标为已完成') {
        var r = S.completeTask(id); rebuild();
        var goOn = function () { if (r.t.proc) followUp(r.t); else UI.toast('已完成并归档') };
        if (r.adv) {
          var msg = '「' + r.adv.stage.name + '」阶段的工序已全部完成，已标为完成' + (r.adv.next ? '；「' + r.adv.next.name + '」进入进行中。' : '。');
          UI.modal({ title: '阶段完成', content: msg, cancel: false, confirmText: '好' }).then(goOn);
        } else goOn();
      }
      else if (it === '修改日期') go('#/task/' + id + '/date');
      else if (it === '转为挂起 · 等待中') { S.waitTask(id, true); rebuild(); UI.toast('已转入挂起区') }
      else if (it === '恢复为待办') { S.waitTask(id, false); rebuild() }
      else if (it === '编辑详情') go('#/task/' + id + '/edit');
      else if (it === '删除') {
        var n = S.delayCount(id);
        var m = '删除「' + t.name + '」？';
        if (t.proc) m += n ? ('\n这是工序任务，将同时删除它的 ' + n + ' 条延迟记录。') : '\n这是工序任务。';
        UI.modal({ title: '删除任务', content: m, danger: true, confirmText: '删除' }).then(function (r) { if (r.confirm) { S.removeTask(id); rebuild() } });
      }
    });
  }
  // 工序完成后弹"下一步"快捷按钮
  function followUp(t) {
    var d = S.load(); var items = d.quick.concat(['自定义…']);
    UI.sheet(items, '「' + t.name + '」完成了，接下来有什么安排？').then(function (i) {
      if (i < 0) return;
      var q = { siteId: t.siteId, stageId: t.stageId || '', date: S.addDays(S.today(), 1) };
      if (items[i] !== '自定义…') q.name = items[i];
      go('#/task/new?' + qs(q));
    });
  }
  function stageMenu(id, rebuild) {
    var d = S.load(); var g = S.getStage(d, id); if (!g) return;
    var all = [{ s: 'done', l: '标为已完成' }, { s: 'current', l: '标为进行中' }, { s: 'pending', l: '标为未开始' }];
    var opts = all.filter(function (o) { return o.s !== g.status });
    UI.sheet(opts.map(function (o) { return o.l }), g.name).then(function (i) {
      if (i < 0) return;
      var adv = S.setStageStatus(id, opts[i].s); rebuild();
      if (opts[i].s === 'done' && adv && adv.next) UI.toast('「' + adv.next.name + '」进入进行中');
    });
  }
  function chipsHtml(chips, filtered) {
    if (!chips.length) return '';
    return '<div class="scrollx"><span class="chip sm' + (!filtered ? ' on' : '') + '" data-act="chip" data-id="all">全部</span>' +
      chips.map(function (c) { return '<span class="chip sm' + (c.on ? ' on' : '') + '" data-act="chip" data-id="' + h(c.id) + '">' + (c.on ? '✓ ' : '') + h(c.name) + '</span>' }).join('') + '</div>';
  }
  function toggleFilter(id) {
    var sel = S.getFilter();
    if (id === 'all') sel = [];
    else { var i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else sel.push(id); }
    S.setFilter(sel);
  }

  // ---------- 工地列表 / 总览 ----------
  function pageSites() {
    setNav('工地进度', 'sites', false);
    var d = S.load(); var td = S.today();
    var idx = {}; d.sites.forEach(function (s, i) { idx[s.id] = i });
    var sites = d.sites.filter(function (s) { return s.status === 'active' })
      .sort(function (a, b) { var oa = ORDER[a.tag || '在建'], ob = ORDER[b.tag || '在建']; return oa !== ob ? oa - ob : idx[a.id] - idx[b.id] });
    var out = '<div class="page"><div class="seg"><div class="seg-item' + (state.sitesView === 'list' ? ' on' : '') + '" data-act="view" data-v="list">列表</div><div class="seg-item' + (state.sitesView === 'matrix' ? ' on' : '') + '" data-act="view" data-v="matrix">总览</div></div>';
    if (state.sitesView === 'list') {
      if (!sites.length) out += '<div class="empty">还没有工地。点下面新建第一个，阶段模板会自动带出。</div>';
      sites.forEach(function (s) {
        var ts = d.tasks.filter(function (t) { return t.siteId === s.id });
        var n = ts.filter(function (t) { return t.st === 'todo' && t.currDate && t.currDate <= td }).length;
        var done = ts.filter(function (t) { return t.st === 'done' }).length;
        var pct = ts.length ? Math.round(done * 100 / ts.length) : 0;
        var cur = d.stages.filter(function (x) { return x.siteId === s.id && x.status === 'current' })[0] || d.stages.filter(function (x) { return x.siteId === s.id })[0];
        var delay = S.siteDelay(d, s.id); var tag = s.tag || '在建';
        out += '<div class="card" data-act="open" data-id="' + h(s.id) + '"><div class="row"><span class="title">' + h(s.name) + '</span>' +
          (tag !== '在建' ? '<span class="tag purple">' + h(tag) + '</span>' : '') +
          '<span class="badge ' + (n ? 'warn' : 'ok') + '">' + (n ? '今日 ' + n + ' 项' : '今日无事') + '</span></div>' +
          '<span class="muted small">' + h(s.addr || '未填地址') + ' · 当前：' + h(cur ? cur.name : '—') + '</span>' +
          (s.note ? '<span class="small block" style="margin-top:3px;color:#55535E;line-height:1.6;">📌 ' + h(s.note) + '</span>' : '') +
          '<div class="bar"><div class="bar-in" style="width:' + pct + '%"></div></div>' +
          '<span class="muted small">任务完成 ' + pct + '%' + (delay ? '<span class="danger"> · 累计延迟' + delay + '天</span>' : '') + '</span></div>';
      });
      out += '<div class="dashed" data-act="add">＋ 新建工地</div>';
    } else {
      var tpl = d.template;
      var cols = tpl.map(function (nm) { return nm.indexOf('CO') > -1 ? 'CO' : nm.charAt(0) });
      var rows = '', selling = '';
      sites.forEach(function (s) {
        if ((s.tag || '在建') === '在售') { selling += '<div class="mrow" data-act="open" data-id="' + h(s.id) + '"><div class="mname muted">' + h(s.name) + '</div><span class="muted small" style="padding-left:4px;">在售 · 不在管线内</span></div>'; return }
        var st = d.stages.filter(function (x) { return x.siteId === s.id }).sort(function (a, b) { return a.order - b.order });
        var cells = tpl.map(function () { return 'pending' });
        var mapped = [];
        st.forEach(function (g) { var ix = -1; tpl.forEach(function (nm, i) { if (ix < 0 && g.name.indexOf(nm) > -1) ix = i }); if (ix >= 0) mapped.push({ idx: ix, st: g.status, kid: !!g.parent }) });
        var firstOpen = tpl.length;
        mapped.forEach(function (m) { if (m.st !== 'done' && m.idx < firstOpen) firstOpen = m.idx });
        for (var i = 0; i < firstOpen; i++) cells[i] = 'done';
        mapped.forEach(function (m) { if (m.st === 'done') cells[m.idx] = 'done'; else if (m.st === 'current') cells[m.idx] = m.kid ? 'parallel' : 'current' });
        if ((s.tag || '') === '等CO') cells[tpl.length - 1] = 'wait';
        rows += '<div class="mrow" data-act="open" data-id="' + h(s.id) + '"><div class="mname">' + h(s.name) + '</div>' + cells.map(function (c) { return '<div class="mcell"><div class="mdot ' + c + '"></div></div>' }).join('') + '</div>';
      });
      var cnt = { '在建': 0, '等CO': 0, '在售': 0 };
      sites.forEach(function (s) { cnt[s.tag || '在建'] = (cnt[s.tag || '在建'] || 0) + 1 });
      out += '<span class="muted small block" style="margin:0 2px 6px;">' + sites.length + '个工地 · ' + cnt['在建'] + '在建 · ' + cnt['等CO'] + '等CO · ' + cnt['在售'] + '在售 · 点任意行跳到该工地</span>' +
        '<div class="card" style="padding:8px 6px 6px;"><div class="mrow head"><div class="mname"></div>' + cols.map(function (c) { return '<div class="mcell"><span class="mcol">' + h(c) + '</span></div>' }).join('') + '</div>' + rows + selling +
        '<div class="legend muted small"><span><span class="mdot done inline"></span> 完成</span><span><span class="mdot current inline"></span> 进行中</span><span><span class="mdot parallel inline"></span> 并行</span><span><span class="mdot wait inline"></span> 等待中</span></div></div>';
    }
    $view.innerHTML = out + '</div>';
    ACT.view = function (ds) { state.sitesView = ds.v; pageSites() };
    ACT.open = function (ds) { go('#/timeline/' + ds.id) };
    ACT.add = function () { go('#/site/new') };
  }

  // ---------- 新建工地 ----------
  function pageNewSite() {
    setNav('新建工地', null, true); $back.setAttribute('href', '#/sites');
    var d = S.load(); var st = d.template.slice();
    var f = { name: '', addr: '', date: S.today(), newStg: '' };
    function draw() {
      $view.innerHTML = '<div class="page">' +
        '<div class="field"><span class="lab">名称</span><input id="f-name" value="' + h(f.name) + '" placeholder="例：Newark Ave 项目"></div>' +
        '<div class="field"><span class="lab">地址（可空）</span><input id="f-addr" value="' + h(f.addr) + '" placeholder="例：120 Newark Ave, Jersey City"></div>' +
        '<div class="field"><span class="lab">开工日期</span><input id="f-date" type="date" value="' + h(f.date) + '"></div>' +
        '<div class="sec">阶段（默认模板 · 可删可加）</div><div class="card" style="padding:6px 12px;">' +
        st.map(function (t, i) { return '<div class="row" style="padding:7px 0;border-bottom:1px solid #F0EEE6;"><span class="muted small" style="width:20px;">' + (i + 1) + '</span><span class="grow">' + h(t) + '</span><span class="muted" data-act="rm" data-i="' + i + '">✕</span></div>' }).join('') +
        '<div class="row" style="padding:7px 0;"><input id="f-new" class="grow" value="' + h(f.newStg) + '" placeholder="加一个自定义阶段"><span class="chip sm" data-act="addStg">加</span></div></div>' +
        '<button class="btn" data-act="create">创建工地</button></div>';
    }
    function sync() { f.name = $view.querySelector('#f-name').value; f.addr = $view.querySelector('#f-addr').value; f.date = $view.querySelector('#f-date').value; f.newStg = $view.querySelector('#f-new').value }
    draw();
    ACT.rm = function (ds) { sync(); st.splice(+ds.i, 1); draw() };
    ACT.addStg = function () { sync(); var v = f.newStg.trim(); if (!v) return; st.push(v); f.newStg = ''; draw() };
    ACT.create = function () {
      sync();
      if (!f.name.trim()) return UI.toast('先填工地名称');
      if (!st.length) return UI.toast('至少保留一个阶段');
      var id = S.createSite({ name: f.name.trim(), addr: f.addr.trim(), start: f.date, stages: st });
      location.replace('#/timeline/' + id);
    };
  }

  // ---------- timeline ----------
  function pageTimeline(siteId) {
    var d = S.load(); var s = S.getSite(d, siteId);
    if (!s) return back('#/sites');
    setNav(s.name, null, true); $back.setAttribute('href', '#/sites');
    var td = S.today(); var exp = state.exp;
    function tv(stageId) {
      return d.tasks.filter(function (t) { return t.stageId === stageId })
        .sort(function (a, b) { return (a.currDate || '9999') < (b.currDate || '9999') ? -1 : 1 })
        .map(function (t) {
          var dateTxt = t.st === 'done' ? (S.fmtShort(t.doneDate) + ' 完成') : (t.currDate ? ('预计 ' + S.fmt(t.currDate) + (t.planDate && t.planDate !== t.currDate ? ' · 原计划 ' + S.fmtShort(t.planDate) : '')) : '日期待定');
          return '<div class="task" data-act="task" data-id="' + h(t.id) + '"><div class="row"><span class="tname grow' + (t.st === 'done' ? ' done' : '') + '">' + h(t.name) + '</span>' +
            (t.proc && t.st !== 'done' ? '<span class="tag amber">工序</span>' : '') + (t.st === 'wait' ? '<span class="tag purple">挂起</span>' : '') + '</div>' +
            '<span class="muted small">' + h(dateTxt) + '</span>' + (t.desc ? '<span class="desc">' + h(t.desc) + '</span>' : '') + '</div>';
        }).join('');
    }
    function sub(st) {
      var ts = d.tasks.filter(function (t) { return t.stageId === st.id });
      if (!ts.length) return '未排期 · 点开添加任务';
      var un = ts.filter(function (t) { return t.st !== 'done' });
      if (!un.length) return ts.length + '个任务 · 全部完成';
      var dated = un.filter(function (t) { return t.currDate }).sort(function (a, b) { return a.currDate < b.currDate ? -1 : 1 });
      if (!dated.length) return un.length + '个进行中 · 日期待定';
      return un.length + '个进行中 · 最近 ' + S.fmtShort(dated[0].currDate);
    }
    var STX = { done: '已完成', current: '进行中', pending: '未开始' };
    var delay = S.siteDelay(d, s.id);
    var out = '<div class="page"><div class="card" style="padding:9px 12px;" data-act="note"><div class="row"><span class="grow" style="font-size:13.5px;line-height:1.6;color:' + (s.note ? '#1F1E26' : '#8C8A94') + ';">' + h(s.note || '点这里写一句现状便签，如：等CO和final survey') + '</span><span class="muted small">✎</span></div>' + (s.noteDate ? '<span class="muted small">' + h(S.fmtShort(s.noteDate)) + ' 更新</span>' : '') + '</div>' +
      '<div class="muted small row" style="margin:0 2px 8px;"><span class="grow">' + (s.start ? '开工 ' + h(S.fmtShort(s.start)) + ' · ' : '') + (delay ? '<span class="danger">累计延迟' + delay + '天</span>' : '<span class="green">未延迟</span>') + '</span><span class="chip sm" data-act="tag">' + h(s.tag || '在建') + ' ▾</span></div><div class="tl">';
    d.stages.filter(function (x) { return x.siteId === s.id && !x.parent }).sort(function (a, b) { return a.order - b.order }).forEach(function (st) {
      var kids = d.stages.filter(function (k) { return k.parent === st.id });
      var open = !!exp[st.id];
      out += '<div class="tl-item"><div class="tdot ' + st.status + '"></div><div class="card" style="margin-bottom:0;" data-act="tgl" data-id="' + h(st.id) + '"><div class="row"><span class="stgname grow">' + h(st.name) + (kids.length ? '<span class="kn"> 含' + h(kids.map(function (k) { return k.name }).join('、')) + '</span>' : '') + '</span>' +
        '<span class="chip sm ' + st.status + '" data-act="stage" data-id="' + h(st.id) + '">' + STX[st.status] + '</span><span class="chip sm" data-act="merge" data-id="' + h(st.id) + '">并入…</span><span class="muted small">' + (open ? '▲' : '▼') + '</span></div>' +
        '<span class="muted small">' + h(sub(st)) + '</span>';
      if (open) {
        kids.forEach(function (k) {
          out += '<div class="kidblk"><div class="row"><span class="grow" style="font-size:13px;font-weight:600;">⛓ ' + h(k.name) + '（并行子阶段）</span><span class="chip sm ' + k.status + '" data-act="stage" data-id="' + h(k.id) + '">' + STX[k.status] + '</span><span class="chip sm" data-act="unmerge" data-id="' + h(k.id) + '">恢复独立</span></div>' + tv(k.id) + '<span class="addlink" data-act="addTask" data-id="' + h(k.id) + '">＋ 添加任务</span></div>';
        });
        out += tv(st.id) + '<span class="addlink" data-act="addTask" data-id="' + h(st.id) + '">＋ 添加任务</span>';
      }
      out += '</div></div>';
    });
    $view.innerHTML = out + '</div></div>';
    var rebuild = function () { pageTimeline(siteId) };
    ACT.note = function () {
      UI.modal({ title: '现状便签', editable: true, placeholder: '一句话描述这个工地现在的状态', content: s.note || '' })
        .then(function (r) { if (r.confirm) { S.updateSiteNote(siteId, (r.content || '').trim()); rebuild() } });
    };
    ACT.tag = function () {
      var tags = ['在建', '等CO', '在售'];
      UI.sheet(tags, '工地状态').then(function (i) { if (i >= 0) { S.setSiteTag(siteId, tags[i]); rebuild() } });
    };
    ACT.tgl = function (ds) { exp[ds.id] = !exp[ds.id]; rebuild() };
    ACT.addTask = function (ds) { go('#/task/new?' + qs({ siteId: siteId, stageId: ds.id })) };
    ACT.task = function (ds) { taskMenu(ds.id, rebuild) };
    ACT.stage = function (ds) { stageMenu(ds.id, rebuild) };
    ACT.merge = function (ds) {
      var id = ds.id;
      if (d.stages.some(function (x) { return x.parent === id })) return UI.toast('它带着子阶段，先恢复它们');
      var opts = d.stages.filter(function (x) { return x.siteId === siteId && !x.parent && x.id !== id && x.status !== 'done' });
      if (!opts.length) return UI.toast('没有可并入的阶段');
      UI.sheet(opts.map(function (o) { return o.name }), '并入哪个阶段（成为它的并行子阶段）').then(function (i) {
        if (i < 0) return;
        S.mergeStage(id, opts[i].id); exp[opts[i].id] = true; rebuild(); UI.toast('已并入「' + opts[i].name + '」');
      });
    };
    ACT.unmerge = function (ds) { S.unmergeStage(ds.id); rebuild() };
  }

  // ---------- 今日 ----------
  function pageToday() {
    setNav('今日', 'today', false);
    var d = S.load(); var td = S.today();
    var sel = S.getFilter(); var filtered = sel.length > 0;
    var inSel = function (t) { return !filtered || sel.indexOf(t.siteId || 'other') >= 0 };
    function meta(t, short) {
      var s = t.siteId === 'other' ? null : S.getSite(d, t.siteId); var g = t.stageId ? S.getStage(d, t.stageId) : null;
      var parts = [];
      if (!short) parts.push(s ? s.name : '其他事项');
      if (g) parts.push(g.name); else if (short && !s) parts.push('其他事项');
      return parts.join(' · ');
    }
    var seen = {}, todayL = [], waitL = [], upL = [], archMap = {};
    d.tasks.slice().sort(function (a, b) { return (a.currDate || '9999') < (b.currDate || '9999') ? -1 : 1 }).forEach(function (t) {
      var live = t.st === 'wait' || (t.st === 'done' ? (t.doneDate && t.doneDate >= td) : true);
      if (live) seen[t.siteId || 'other'] = 1;
      if (!inSel(t)) return;
      var m = meta(t, filtered);
      if (t.st === 'wait') { waitL.push(Object.assign({}, t, { m: m, wd: Math.max(0, S.diff(td, t.waitSince || t.currDate)), pend: false })); return }
      if (t.st === 'todo' && !t.currDate) { waitL.push(Object.assign({}, t, { m: m, wd: 0, pend: true })); return }
      if (t.st === 'done') {
        if (t.doneDate && t.doneDate < td) { var k = t.doneDate.slice(0, 7); (archMap[k] = archMap[k] || []).push(Object.assign({}, t, { m: m, dTxt: S.fmtShort(t.doneDate) + ' 完成' })) }
        else todayL.push(Object.assign({}, t, { m: m, doneToday: true }));
        return;
      }
      if (!t.currDate) return;
      if (t.currDate <= td) todayL.push(Object.assign({}, t, { m: m, od: t.currDate < td ? S.diff(td, t.currDate) : 0 }));
      else upL.push(Object.assign({}, t, { m: m, left: S.diff(t.currDate, td), dTxt: S.fmt(t.currDate) }));
    });
    var archN = 0;
    var arch = Object.keys(archMap).sort().reverse().map(function (k) { archN += archMap[k].length; return { label: k.replace('-', '年') + '月', items: archMap[k] } });
    var todo = todayL.filter(function (t) { return !t.doneToday }).length;
    var chips = d.sites.filter(function (x) { return x.status === 'active' && seen[x.id] }).map(function (x) { return { id: x.id, name: x.name, on: sel.indexOf(x.id) >= 0 } });
    if (seen.other) chips.push({ id: 'other', name: '其他', on: sel.indexOf('other') >= 0 });
    var siteNotes = sel.map(function (id) { var x = S.getSite(d, id); return x && x.note ? { name: x.name, note: x.note } : null }).filter(function (x) { return x });
    var one = (sel.length === 1 && sel[0] !== 'other') ? S.getSite(d, sel[0]) : null;
    var descOf = function (t) { return t.desc ? '<span class="desc">' + h(t.desc) + '</span>' : '' };
    var out = '<div class="page"><div class="row" style="margin:0 2px 6px;"><span class="title">' + h(S.fmt(td)) + '</span><span class="muted small">' + todo + ' 项待办 · ' + waitL.filter(function (x) { return !x.pend }).length + ' 挂起 · ' + waitL.filter(function (x) { return x.pend }).length + ' 待定</span></div>' + chipsHtml(chips, filtered);
    if (siteNotes.length) out += '<div style="background:#EEEDFE;border-radius:7px;padding:6px 9px;margin-bottom:7px;">' + siteNotes.map(function (n) { return '<span class="small block" style="color:#3C3489;line-height:1.7;">📌 ' + (siteNotes.length > 1 ? h(n.name) + '：' : '') + h(n.note) + '</span>' }).join('') + '</div>';
    out += '<div class="sec">今日任务 · 点任务弹出操作</div>' + (!todayL.length ? '<div class="muted small" style="margin:0 2px 5px;">今天没有任务</div>' : '');
    todayL.forEach(function (t) {
      out += '<div class="trow' + (t.od ? ' od' : '') + '" data-act="task" data-id="' + h(t.id) + '"><span style="font-size:16px;">' + (t.doneToday ? '☑' : '☐') + '</span><div class="grow"><span class="tname' + (t.doneToday ? ' done' : '') + '">' + h(t.name) + '</span><span class="muted small block">' + h(t.m) + (t.od ? '<span class="danger"> · 已逾期' + t.od + '天</span>' : '') + (t.doneToday ? ' · 今天完成' : '') + '</span>' + descOf(t) + '</div>' + (t.proc && !t.doneToday ? '<span class="tag amber">工序</span>' : '') + '</div>';
    });
    out += '<div class="sec">进行中 · 挂起 · 待定</div>' + (!waitL.length ? '<div class="muted small" style="margin:0 2px 5px;">没有挂起或待定的事项</div>' : '');
    waitL.forEach(function (t) {
      out += '<div class="trow" data-act="task" data-id="' + h(t.id) + '"><span style="font-size:16px;">' + (t.pend ? '◇' : '◌') + '</span><div class="grow"><span class="tname">' + h(t.name) + '</span><span class="muted small block">' + h(t.m) + (t.pend ? ' · 日期未定' : ' · 已等待' + t.wd + '天') + '</span>' + descOf(t) + '</div>' + (t.pend && t.proc ? '<span class="tag amber">工序</span>' : '') + '<span class="tag purple">' + (t.pend ? '待定' : '等待中') + '</span></div>';
    });
    out += '<div class="sec">即将到来</div>' + (!upL.length ? '<div class="muted small" style="margin:0 2px 5px;">暂无</div>' : '');
    upL.forEach(function (t) {
      out += '<div class="trow" data-act="task" data-id="' + h(t.id) + '"><span style="font-size:15px;">◷</span><div class="grow"><span class="tname">' + h(t.name) + '</span><span class="muted small block">' + h(t.m) + ' · ' + h(t.dTxt) + '</span>' + descOf(t) + '</div><span class="badge warn">' + (t.left === 1 ? '明天' : '还有' + t.left + '天') + '</span>' + (t.proc ? '<span class="tag amber">工序</span>' : '') + '</div>';
    });
    out += '<div class="dashed" data-act="add">' + (one ? '＋ 给 ' + h(one.name) + ' 添加任务' : '＋ 添加任务') + '</div>' +
      '<div class="row" style="border-top:1px solid #E8E6DE;padding:9px 2px;cursor:pointer;" data-act="arch"><span class="grow" style="color:#55535E;">已归档 · ' + archN + ' 条</span><span class="muted small">' + (state.archOpen ? '▲' : '▼') + '</span></div>';
    if (state.archOpen) arch.forEach(function (g) {
      out += '<div class="sec">' + h(g.label) + '</div>' + g.items.map(function (t) { return '<div class="trow" data-act="task" data-id="' + h(t.id) + '"><span style="font-size:16px;">☑</span><div class="grow"><span class="tname done">' + h(t.name) + '</span><span class="muted small block">' + h(t.m) + ' · ' + h(t.dTxt) + '</span>' + descOf(t) + '</div></div>' }).join('');
    });
    $view.innerHTML = out + '</div>';
    ACT.chip = function (ds) { toggleFilter(ds.id); pageToday() };
    ACT.task = function (ds) { taskMenu(ds.id, pageToday) };
    ACT.arch = function () { state.archOpen = !state.archOpen; pageToday() };
    ACT.add = function () { go('#/task/new' + (one ? '?siteId=' + one.id : '')) };
  }

  // ---------- 日历 ----------
  function pageCalendar() {
    setNav('日历', 'calendar', false);
    var d = S.load(); var td = S.today();
    if (!state.cal) { var t0 = new Date(); state.cal = { y: t0.getFullYear(), m: t0.getMonth(), sel: td } }
    var y = state.cal.y, m = state.cal.m, sel = state.cal.sel;
    var fsel = S.getFilter(); var filtered = fsel.length > 0;
    var mon = y + '-' + (m + 1 < 10 ? '0' : '') + (m + 1);
    var seen = {};
    d.tasks.forEach(function (t) { var ds = t.st === 'done' ? t.doneDate : t.currDate; if (ds && ds.slice(0, 7) === mon) seen[t.siteId || 'other'] = 1 });
    var tasks = d.tasks.filter(function (t) { return !filtered || fsel.indexOf(t.siteId || 'other') >= 0 });
    var startW = (new Date(y, m, 1).getDay() + 6) % 7; var days = new Date(y, m + 1, 0).getDate();
    var cells = '';
    for (var i = 0; i < startW; i++) cells += '<div class="cell"></div>';
    for (var dd = 1; dd <= days; dd++) {
      var ds = S.isoOf(y, m, dd); var dots = '';
      var n = 0;
      tasks.forEach(function (t) {
        var on = t.st === 'done' ? (t.doneDate === ds) : (t.st !== 'wait' && t.currDate && t.currDate === ds);
        if (!on || n >= 3) return; n++;
        dots += '<span class="dotc" style="background:' + (t.st === 'done' ? '#5DCAA5' : (ds < td ? '#E24B4A' : (ds === td ? '#EF9F27' : '#7F77DD'))) + ';"></span>';
      });
      cells += '<div class="cell" data-act="day" data-ds="' + ds + '"><div class="daynum' + (ds === sel ? ' sel' : (ds === td ? ' today' : '')) + '">' + dd + '</div><div class="dots">' + dots + '</div></div>';
    }
    var list = tasks.filter(function (t) { return t.st === 'done' ? t.doneDate === sel : (t.st !== 'wait' && t.currDate && t.currDate === sel) }).map(function (t) {
      var g = t.stageId ? S.getStage(d, t.stageId) : null;
      var stTxt = t.st === 'done' ? '已完成' : (t.currDate < td ? '已逾期' : (t.currDate === td ? '今日' : '计划'));
      return '<div class="trow" data-act="task" data-id="' + h(t.id) + '"><div class="grow"><span class="tname' + (t.st === 'done' ? ' done' : '') + '">' + h(t.name) + '</span><span class="muted small block">' + h(filtered ? (g ? g.name : (t.siteId === 'other' ? '其他事项' : '')) : S.taskMeta(d, t)) + '</span>' + (t.desc ? '<span class="desc">' + h(t.desc) + '</span>' : '') + '</div><span class="badge ' + (stTxt === '已完成' ? 'ok' : (stTxt === '已逾期' ? 'warn' : 'purple')) + '">' + stTxt + '</span></div>';
    }).join('');
    var chips = d.sites.filter(function (x) { return x.status === 'active' && seen[x.id] }).map(function (x) { return { id: x.id, name: x.name, on: fsel.indexOf(x.id) >= 0 } });
    if (seen.other) chips.push({ id: 'other', name: '其他', on: fsel.indexOf('other') >= 0 });
    $view.innerHTML = '<div class="page"><div class="row" style="margin-bottom:7px;"><span class="chip sm" data-act="prev">‹ 上月</span><span class="title" style="text-align:center;">' + y + '年' + (m + 1) + '月</span><span class="chip sm" data-act="next">下月 ›</span></div>' + chipsHtml(chips, filtered) +
      '<div class="grid head"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="grid">' + cells + '</div>' +
      '<div class="clegend"><span><span class="dotc" style="background:#5DCAA5;"></span> 完成</span><span><span class="dotc" style="background:#7F77DD;"></span> 计划</span><span><span class="dotc" style="background:#EF9F27;"></span> 今日</span><span><span class="dotc" style="background:#E24B4A;"></span> 逾期</span></div>' +
      '<div class="sec">' + h(S.fmt(sel)) + '</div>' + (list || '<div class="muted small" style="margin:0 2px;">这天没有任务</div>') + '</div>';
    ACT.chip = function (ds) { toggleFilter(ds.id); pageCalendar() };
    ACT.prev = function () { state.cal.m--; if (state.cal.m < 0) { state.cal.m = 11; state.cal.y-- } pageCalendar() };
    ACT.next = function () { state.cal.m++; if (state.cal.m > 11) { state.cal.m = 0; state.cal.y++ } pageCalendar() };
    ACT.day = function (ds) { state.cal.sel = ds.ds; pageCalendar() };
    ACT.task = function (ds) { taskMenu(ds.id, pageCalendar) };
  }

  // ---------- 日记列表 ----------
  function pageDiary() {
    setNav('日记', 'diary', false);
    var d = S.load(); var td = S.today(); var fid = state.diaryFilter;
    var filters = [{ id: 'all', name: '全部' }].concat(d.sites.filter(function (s) { return s.status === 'active' }).map(function (s) { return { id: s.id, name: s.name } }));
    var list = d.diaries.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1 })
      .filter(function (e) { return fid === 'all' || (e.blocks || []).some(function (b) { return b.siteId === fid }) })
      .map(function (e) {
        var names = (e.blocks || []).map(function (b) { if (b.siteId === 'other') return '其他'; var s = S.getSite(d, b.siteId); return s ? s.name : '' }).filter(function (x) { return x });
        var snip = ''; (e.blocks || []).forEach(function (b) { if (!snip && b.events) snip = b.events });
        if (snip.length > 46) snip = snip.slice(0, 46) + '…';
        var tm = (e.tomorrow || []).length;
        return '<div class="card" data-act="open" data-id="' + h(e.id) + '"><div class="row"><span class="title">' + h(S.fmt(e.date)) + '</span><span class="muted small">' + h(e.weather || '') + '</span></div><span class="muted small block">' + h(names.join(' · ') || '未记工地') + '</span>' + (snip ? '<span class="small block" style="margin-top:4px;color:#55535E;line-height:1.6;">' + h(snip) + '</span>' : '') + (tm ? '<span class="muted small block" style="margin-top:3px;">明日事项 ' + tm + ' 条</span>' : '') + '</div>';
      }).join('');
    $view.innerHTML = '<div class="page"><div class="dashed" data-act="today">' + (S.getDiary(td) ? '✎ 继续写今天的日记' : '✎ 写今天的日记') + '</div><div class="scrollx">' +
      filters.map(function (f) { return '<span class="chip sm' + (fid === f.id ? ' on' : '') + '" data-act="filter" data-id="' + h(f.id) + '">' + h(f.name) + '</span>' }).join('') + '</div>' +
      (list || '<div class="empty">还没有日记。每天的任务完成和延迟会自动带进当天的日记里，你只补人数、事件、订货这些。</div>') + '</div>';
    ACT.today = function () { go('#/diary/new?date=' + td) };
    ACT.open = function (ds) { go('#/diary/' + ds.id) };
    ACT.filter = function (ds) { state.diaryFilter = ds.id; pageDiary() };
  }

  // ---------- 日记编辑 ----------
  function pageDiaryEdit(id, q) {
    var d = S.load(); var td = S.today();
    var entry = id === 'new' ? S.getDiary(q.date || td) : S.getDiaryById(id);
    var date = entry ? entry.date : (q.date || td);
    setNav('日记', null, true); $back.setAttribute('href', '#/diary');
    var f = {
      weather: entry ? (entry.weather || '') : '',
      blocks: entry ? (entry.blocks || []).map(function (b) { return Object.assign({}, b) }) : [],
      tomorrow: entry ? (entry.tomorrow || []).map(function (x) { return Object.assign({}, x) }) : [],
      newTm: ''
    };
    function sync() {
      var w = $view.querySelector('#f-weather'); if (w) f.weather = w.value;
      f.blocks.forEach(function (b, i) { ['workers', 'events', 'orders', 'spend', 'showing'].forEach(function (k) { var el = $view.querySelector('[data-b="' + i + '"][data-f="' + k + '"]'); if (el) b[k] = el.value }) });
      var nt = $view.querySelector('#f-newtm'); if (nt) f.newTm = nt.value;
    }
    function saveEntry(silent) {
      sync();
      entry = S.saveDiary({
        id: entry ? entry.id : undefined, date: date, weather: f.weather.trim(),
        blocks: f.blocks.map(function (b) { return { siteId: b.siteId, workers: (b.workers || '').trim(), events: (b.events || '').trim(), orders: (b.orders || '').trim(), spend: (b.spend || '').trim(), showing: (b.showing || '').trim() } }),
        tomorrow: f.tomorrow.map(function (x) { return { text: x.text, cv: !!x.cv, taskId: x.taskId || '' } })
      });
      if (!silent) UI.toast('日记已保存');
      return entry;
    }
    function draw() {
      d = S.load();
      var waits = d.tasks.filter(function (t) { return t.st === 'wait' }).map(function (t) { return '◌ ' + t.name + ' · ' + S.taskMeta(d, t) + ' · 已等待' + Math.max(0, S.diff(td, t.waitSince || t.currDate)) + '天' });
      var out = '<div class="page"><div class="row" style="margin:0 2px 7px;"><span class="title">' + h(S.fmt(date)) + '</span><input id="f-weather" value="' + h(f.weather) + '" placeholder="天气（可空）" style="width:90px;text-align:right;font-size:13px;"></div>';
      f.blocks.forEach(function (b, i) {
        var nm = b.siteId === 'other' ? '其他' : ((S.getSite(d, b.siteId) || {}).name || '');
        var sys = b.siteId === 'other' ? [] : S.sysLines(d, date, b.siteId);
        var fld = function (k, lab, ph, ta) { return '<div class="field"><span class="lab">' + lab + '</span>' + (ta ? '<textarea rows="2" data-b="' + i + '" data-f="' + k + '" placeholder="' + ph + '">' + h(b[k] || '') + '</textarea>' : '<input data-b="' + i + '" data-f="' + k + '" value="' + h(b[k] || '') + '" placeholder="' + ph + '">') + '</div>' };
        out += '<div class="card"><div class="row"><span class="grow" style="font-size:14px;font-weight:600;">📍 ' + h(nm) + '</span><span class="muted" data-act="rmBlock" data-i="' + i + '" style="cursor:pointer;">✕</span></div>' +
          (sys.length ? '<div style="background:#FAF9F5;border-radius:6px;padding:6px 8px;margin:5px 0;"><span class="muted small block" style="margin-bottom:2px;">系统记录 · 自动带入</span>' + sys.map(function (l) { return '<span class="small block" style="color:#55535E;line-height:1.7;">' + h(l) + '</span>' }).join('') + '</div>' : '') +
          '<div style="margin-top:5px;">' + fld('workers', '人数（如：砌砖2、杂活3）', '留空跳过') + fld('events', '事件', '今天发生了什么，自由写', true) + fld('orders', '订货', '留空跳过') + fld('spend', '花销', '如：$40 小费·现金') + fld('showing', '看房', '经纪人、客人反应、意向（留空跳过）', true) + '</div></div>';
      });
      out += '<div class="dashed" data-act="addBlock">＋ 添加工地板块</div>';
      if (waits.length) out += '<div class="card"><span class="block" style="font-size:14px;font-weight:600;margin-bottom:4px;">跟进中 · 挂起任务</span>' + waits.map(function (w) { return '<span class="small block" style="color:#55535E;line-height:1.8;">' + h(w) + '</span>' }).join('') + '</div>';
      out += '<div class="card"><span class="block" style="font-size:14px;font-weight:600;margin-bottom:5px;">明日事项</span>' +
        f.tomorrow.map(function (x, i) { return '<div class="row" style="padding:5px 0;border-bottom:1px solid #F0EEE6;"><span class="grow' + (x.cv ? ' muted' : '') + '" style="font-size:13px;">' + h(x.text) + '</span>' + (x.cv ? '<span class="badge ok">✓ 已转</span>' : '<span class="chip sm" data-act="cvTm" data-i="' + i + '">转为任务</span>') + '<span class="muted" data-act="rmTm" data-i="' + i + '" style="margin-left:5px;cursor:pointer;">✕</span></div>' }).join('') +
        '<div class="row" style="padding:6px 0 1px;"><input id="f-newtm" class="grow" value="' + h(f.newTm) + '" placeholder="写一条明天要做的事"><span class="chip sm" data-act="addTm">加</span></div></div>' +
        '<button class="btn" data-act="save">保存日记</button></div>';
      $view.innerHTML = out;
    }
    draw();
    ACT.addBlock = function () {
      sync();
      var opts = d.sites.filter(function (s) { return s.status === 'active' }).map(function (s) { return { id: s.id, name: s.name } }); opts.push({ id: 'other', name: '其他' });
      var used = f.blocks.map(function (b) { return b.siteId }); var avail = opts.filter(function (o) { return used.indexOf(o.id) < 0 });
      if (!avail.length) return UI.toast('所有工地都已添加');
      var put = function (o) { f.blocks.push({ siteId: o.id, workers: '', events: '', orders: '', spend: '', showing: '' }); draw() };
      if (opts.length === 1) { put(avail[0]); return UI.toast('还没有工地，先记在「其他」；新建工地后可按工地分块', 2500) }
      UI.sheet(avail.map(function (o) { return o.name }), '添加哪个工地的板块').then(function (i) { if (i >= 0) put(avail[i]) });
    };
    ACT.rmBlock = function (ds) {
      sync();
      UI.modal({ title: '移除板块', content: '移除这个工地板块？已写的内容会丢失。', danger: true, confirmText: '移除' }).then(function (r) { if (r.confirm) { f.blocks.splice(+ds.i, 1); draw() } });
    };
    ACT.addTm = function () { sync(); var v = f.newTm.trim(); if (!v) return; f.tomorrow.push({ text: v, cv: false }); f.newTm = ''; saveEntry(true); draw() };
    ACT.rmTm = function (ds) { sync(); f.tomorrow.splice(+ds.i, 1); saveEntry(true); draw() };
    ACT.cvTm = function (ds) {
      var i = +ds.i; if (f.tomorrow[i].cv) return;
      var e = saveEntry(true);
      go('#/task/new?' + qs({ name: f.tomorrow[i].text, date: S.addDays(date, 1), tmDiary: e.id, tmIdx: i }));
    };
    ACT.save = function () { saveEntry(false); back('#/diary') };
  }

  // ---------- 任务编辑 / 修改日期 ----------
  function pageTaskEdit(tid, q, dateOnly) {
    var d = S.load(); var t = tid ? S.getTask(d, tid) : null;
    if (tid && !t) return back('#/today');
    setNav(dateOnly ? '修改日期' : (t ? '编辑任务' : '添加任务'), null, true); $back.setAttribute('href', '#/today');
    var siteOpts = d.sites.filter(function (s) { return s.status === 'active' }).map(function (s) { return { id: s.id, name: s.name } });
    siteOpts.push({ id: 'other', name: '其他（不挂工地）' });
    function stageOpts(siteId) {
      if (siteId === 'other') return [];
      return d.stages.filter(function (s) { return s.siteId === siteId }).sort(function (a, b) { return a.order - b.order }).map(function (s) { return { id: s.id, label: (s.parent ? '↳ ' : '') + s.name } });
    }
    var f = {
      name: t ? t.name : (q.name || ''), desc: t ? t.desc : '',
      siteId: t ? t.siteId : (q.siteId || siteOpts[0].id), stageId: t ? t.stageId : (q.stageId || null),
      proc: t ? !!t.proc : false, noDate: t ? !t.currDate : false,
      date: (t && t.currDate) ? t.currDate : (q.date || S.today()), reason: ''
    };
    var isProc = !!(t && t.proc), hasDate = !!(t && t.currDate);
    function sync() {
      var g = function (id) { var el = $view.querySelector('#' + id); return el ? el.value : undefined };
      if (dateOnly) { f.date = g('f-date') || f.date; f.reason = g('f-reason') || ''; return }
      f.name = g('f-name'); f.desc = g('f-desc'); f.siteId = g('f-site');
      var sv = g('f-stage'); if (sv !== undefined) f.stageId = sv;
      var dv = g('f-date'); if (dv !== undefined) f.date = dv;
    }
    function draw() {
      var out = '<div class="page">';
      if (dateOnly) {
        out += '<div class="field"><span class="lab">任务</span><span>' + h(t.name) + '</span></div>' +
          '<div class="field"><span class="lab">日期（当前 ' + h(t.currDate || '待定') + (t.planDate && t.planDate !== t.currDate ? '，原计划 ' + h(t.planDate) : '') + '）</span><input id="f-date" type="date" value="' + h(f.date) + '"></div>' +
          (isProc ? '<div class="field"><span class="lab">延迟原因（可空，如：下雨、材料没到）</span><input id="f-reason" value="' + h(f.reason) + '" placeholder="往后改期时记入延迟流水"></div><div class="muted small" style="margin:0 2px 8px;line-height:1.6;">工序任务：往后改会自动记一条延迟，并顺延同阶段后续未完成工序；往前改视为提前，不记延迟。</div>' : '') +
          '<button class="btn" data-act="save">确定</button>';
      } else {
        var stages = stageOpts(f.siteId);
        if (stages.length && !stages.some(function (s) { return s.id === f.stageId })) f.stageId = stages[0].id;
        out += '<div class="field"><span class="lab">任务名</span><input id="f-name" value="' + h(f.name) + '" placeholder="例：砌三楼砖"></div>' +
          '<div class="field"><span class="lab">备注（可空）</span><textarea id="f-desc" rows="2" placeholder="例：砖用上次那家，联系 Mike 917-xxx">' + h(f.desc) + '</textarea></div>' +
          '<div class="field"><span class="lab">归属</span><select id="f-site" data-act-change="site">' + siteOpts.map(function (s) { return '<option value="' + h(s.id) + '"' + (s.id === f.siteId ? ' selected' : '') + '>' + h(s.name) + '</option>' }).join('') + '</select></div>' +
          (stages.length ? '<div class="field"><span class="lab">阶段</span><select id="f-stage">' + stages.map(function (s) { return '<option value="' + h(s.id) + '"' + (s.id === f.stageId ? ' selected' : '') + '>' + h(s.label) + '</option>' }).join('') + '</select></div>' : '');
        if (!(isProc && hasDate)) out += '<div class="field row"><span class="grow">日期待定（不进今日和日历，只留在 timeline）</span><span class="switch' + (f.noDate ? ' on' : '') + '" data-act="noDate"></span></div>';
        else out += '<div class="muted small" style="margin:0 2px 6px;">工序任务已有日期，不可改为待定；要改期请走"修改日期"。</div>';
        if (!f.noDate || (isProc && hasDate)) out += '<div class="field"><span class="lab">日期</span><input id="f-date" type="date" value="' + h(f.date) + '"></div>';
        if (!t && stages.length) out += '<div class="field row"><span class="grow">工序任务（改期记延迟并顺延后续）</span><span class="switch' + (f.proc ? ' on' : '') + '" data-act="proc"></span></div>';
        out += '<button class="btn" data-act="save">保存</button>' + (t && !isProc ? '<button class="btn danger" data-act="del">删除任务</button>' : '');
      }
      $view.innerHTML = out + '</div>';
      var sel = $view.querySelector('#f-site'); if (sel) sel.addEventListener('change', function () { sync(); f.stageId = null; draw() });
    }
    draw();
    ACT.noDate = function () { sync(); f.noDate = !f.noDate; draw() };
    ACT.proc = function () { sync(); f.proc = !f.proc; draw() };
    ACT.save = function () {
      sync();
      if (dateOnly) {
        if (!f.date) return UI.toast('先选日期');
        var n = S.changeDate(tid, f.date, f.reason.trim());
        UI.toast(n > 0 ? '已顺延' + n + '天，延迟已记录' : '日期已更新');
        return back('#/today');
      }
      if (!f.name.trim()) return UI.toast('先填任务名');
      var stageId = null;
      if (f.siteId !== 'other') { var st = stageOpts(f.siteId); if (!st.length) return UI.toast('该工地没有阶段'); stageId = f.stageId || st[0].id }
      var noDate = f.noDate && !(isProc && hasDate);
      var dv = noDate ? '' : f.date;
      if (!noDate && !dv) return UI.toast('先选日期或打开"日期待定"');
      if (t) {
        S.updateTask(tid, { name: f.name.trim(), desc: f.desc.trim(), siteId: f.siteId, stageId: stageId });
        var cur = S.getTask(S.load(), tid);
        if (noDate) { if (cur.currDate) S.updateTask(tid, { currDate: '' }) }
        else if (cur.currDate !== dv) S.changeDate(tid, dv);
      } else {
        var nt = S.addTask({ siteId: f.siteId, stageId: stageId, name: f.name.trim(), desc: f.desc.trim(), date: dv, proc: f.siteId !== 'other' && f.proc });
        if (q.tmDiary && q.tmIdx != null) S.markTomorrowConverted(q.tmDiary, +q.tmIdx, nt.id);
      }
      back('#/today');
    };
    ACT.del = function () {
      UI.modal({ title: '删除任务', content: '确定删除？', danger: true, confirmText: '删除' }).then(function (r) { if (r.confirm) { S.removeTask(tid); back('#/today') } });
    };
  }

  // ---------- 设置 ----------
  function pageSettings() {
    setNav('设置', 'settings', false);
    var d = S.load();
    var listCard = function (arr, rmAct, addAct, inputId, ph) {
      return '<div class="card" style="padding:6px 12px;">' + arr.map(function (t, i) { return '<div class="row" style="padding:7px 0;border-bottom:1px solid #F0EEE6;"><span class="muted small" style="width:20px;">' + (i + 1) + '</span><span class="grow">' + h(t) + '</span><span class="muted" data-act="' + rmAct + '" data-i="' + i + '" style="cursor:pointer;">✕</span></div>' }).join('') +
        '<div class="row" style="padding:7px 0;"><input id="' + inputId + '" class="grow" placeholder="' + ph + '"><span class="chip sm" data-act="' + addAct + '">加</span></div></div>';
    };
    $view.innerHTML = '<div class="page"><div class="sec">阶段模板 · 新建工地时带出</div>' + listCard(d.template, 'rmTpl', 'addTpl', 'f-tpl', '加一个阶段') +
      '<div class="sec">下一步快捷按钮 · 工序完成后弹出</div>' + listCard(d.quick, 'rmQk', 'addQk', 'f-qk', '加一个快捷按钮') +
      '<div class="sec">数据</div><div class="card"><span class="small block" style="color:#55535E;line-height:1.7;">网页演示版：数据只存在这个浏览器里（localStorage），不会上传。关掉再开还在，换浏览器就没有。小程序正式版的数据在公司云端多人共享，带白名单门禁、任务指派和微信推送提醒。</span></div>' +
      '<button class="btn ghost" data-act="demo">重置为示例数据</button><button class="btn ghost" data-act="clear">清空全部数据</button>' +
      '<div class="sec">关于</div><div class="card"><span class="small block" style="color:#55535E;line-height:1.8;">工地进度 · 小型建筑/翻建团队的进度管理工具。核心规则：工序任务改期自动记延迟并顺延同阶段后续工序；原计划 / 当前计划 / 实际完成三条日期并存；日期可空=待定；挂起任务显示已等待天数；工序全部完成自动推进阶段；日记自动带入当天的完成与延迟记录。<br>原生微信小程序，此为网页移植版。<a href="https://github.com/charleschaohu-hash/gongdi-web" target="_blank" rel="noopener" style="color:#534AB7;">源码 ↗</a></span></div></div>';
    ACT.rmTpl = function (ds) { d.template.splice(+ds.i, 1); S.persist(); pageSettings() };
    ACT.addTpl = function () { var v = $view.querySelector('#f-tpl').value.trim(); if (!v) return; d.template.push(v); S.persist(); pageSettings() };
    ACT.rmQk = function (ds) { d.quick.splice(+ds.i, 1); S.persist(); pageSettings() };
    ACT.addQk = function () { var v = $view.querySelector('#f-qk').value.trim(); if (!v) return; d.quick.push(v); S.persist(); pageSettings() };
    ACT.demo = function () { UI.modal({ title: '重置为示例数据', content: '会覆盖当前浏览器里的全部数据，确定？' }).then(function (r) { if (r.confirm) { S.replaceAll(DEMO.build(S)); state.exp = {}; S.setFilter([]); UI.toast('已载入示例数据'); pageSettings() } }) };
    ACT.clear = function () { UI.modal({ title: '清空全部数据', content: '清空后从零开始，确定？', danger: true, confirmText: '清空' }).then(function (r) { if (r.confirm) { S.resetAll(); state.exp = {}; S.setFilter([]); UI.toast('已清空'); pageSettings() } }) };
  }

  render();
})();
