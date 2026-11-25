var S = require('../../utils/store');
var ORDER = { '在建': 0, '等CO': 1, '在售': 2 };

Page({
  data: { view: 'list', list: [], cols: [], rows: [], selling: [], summary: '' },
  onShow: function () { this.build() },
  setView: function (e) { this.setData({ view: e.currentTarget.dataset.v }) },
  build: function () {
    var d = S.load(); var td = S.today();
    var idx = {}; d.sites.forEach(function (s, i) { idx[s.id] = i });
    var sites = d.sites.filter(function (s) { return s.status === 'active' })
      .sort(function (a, b) {
        var oa = ORDER[a.tag || '在建'], ob = ORDER[b.tag || '在建'];
        return oa !== ob ? oa - ob : idx[a.id] - idx[b.id];
      });

    // ---- 列表视图 ----
    var list = sites.map(function (s) {
      var ts = d.tasks.filter(function (t) { return t.siteId === s.id });
      var n = ts.filter(function (t) { return t.st === 'todo' && t.currDate && t.currDate <= td }).length;
      var done = ts.filter(function (t) { return t.st === 'done' }).length;
      var cur = d.stages.filter(function (x) { return x.siteId === s.id && x.status === 'current' })[0] ||
                d.stages.filter(function (x) { return x.siteId === s.id })[0];
      return {
        id: s.id, name: s.name, addr: s.addr, n: n,
        pct: ts.length ? Math.round(done * 100 / ts.length) : 0,
        cur: cur ? cur.name : '—', delay: S.siteDelay(d, s.id),
        tag: s.tag || '在建', note: s.note || ''
      };
    });

    // ---- 总览矩阵:列 = 阶段模板 ----
    var tpl = d.template;
    var cols = tpl.map(function (nm, i) { return { k: i, t: nm.indexOf('CO') > -1 ? 'CO' : nm.charAt(0) } });
    var rows = [], selling = [];
    sites.forEach(function (s) {
      if ((s.tag || '在建') === '在售') { selling.push({ id: s.id, name: s.name }); return }
      var st = d.stages.filter(function (x) { return x.siteId === s.id })
        .sort(function (a, b) { return a.order - b.order });
      var cells = tpl.map(function () { return 'pending' });
      // 按名字把工地阶段映射到模板列(模板名包含于阶段名即算匹配,如"外墙(收尾)"→外墙)
      var mapped = [];
      st.forEach(function (g) {
        var idx = -1;
        tpl.forEach(function (nm, i) { if (idx < 0 && g.name.indexOf(nm) > -1) idx = i });
        if (idx >= 0) mapped.push({ idx: idx, st: g.status, kid: !!g.parent });
      });
      // 已完成折叠阶段(没匹配到模板名)之前的列:第一个未完成的映射列之前全部记完成
      var firstOpen = tpl.length;
      mapped.forEach(function (m) { if (m.st !== 'done' && m.idx < firstOpen) firstOpen = m.idx });
      for (var i = 0; i < firstOpen; i++) cells[i] = 'done';
      mapped.forEach(function (m) {
        if (m.st === 'done') cells[m.idx] = 'done';
        else if (m.st === 'current') cells[m.idx] = m.kid ? 'parallel' : 'current';
      });
      if ((s.tag || '') === '等CO') cells[tpl.length - 1] = 'wait';
      rows.push({ id: s.id, name: s.name, cells: cells.map(function (c, i) { return { k: i, c: c } }) });
    });

    var cnt = { '在建': 0, '等CO': 0, '在售': 0 };
    sites.forEach(function (s) { cnt[s.tag || '在建'] = (cnt[s.tag || '在建'] || 0) + 1 });
    var summary = sites.length + '个工地 · ' + cnt['在建'] + '在建 · ' + cnt['等CO'] + '等CO · ' + cnt['在售'] + '在售';

    this.setData({ isAdmin: S.isAdmin(), view: S.isAdmin() ? this.data.view : 'list', list: list, cols: cols, rows: rows, selling: selling, summary: summary });
  },
  open: function (e) { wx.navigateTo({ url: '/pages/timeline/timeline?siteId=' + e.currentTarget.dataset.id }) },
  add: function () { wx.navigateTo({ url: '/pages/newsite/newsite' }) }
});
