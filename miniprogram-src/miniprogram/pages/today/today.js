var S = require('../../utils/store');
Page({
  data: { dateTxt: '', count: '', todayL: [], waitL: [], upL: [], arch: [], archN: 0, archOpen: false, notes: [],
          chips: [], sel: [], filtered: false, siteNotes: [], addLabel: '＋ 添加任务' },
  onShow: function () { this.build() },
  // 任务行文案:全部视图带工地名;筛选视图只留阶段(+负责人)
  meta: function (d, t, short) {
    var s = t.siteId === 'other' ? null : S.getSite(d, t.siteId);
    var g = t.stageId ? S.getStage(d, t.stageId) : null;
    var parts = [];
    if (!short) parts.push(s ? s.name : '其他事项');
    if (g) parts.push(g.name); else if (short && !s) parts.push('其他事项');
    if (t.assignee && t.assignee !== S.myOpen()) parts.push(S.memberName(t.assignee));
    return parts.join(' · ');
  },
  build: function () {
    var that = this; var d = S.load(); var td = S.today();
    var sel = S.getFilter(); var filtered = sel.length > 0;
    var inSel = function (t) { return !filtered || sel.indexOf(t.siteId || 'other') >= 0 };
    var seen = {};
    var todayL = [], waitL = [], upL = [], archMap = {};
    d.tasks.slice().sort(function (a, b) { return (a.currDate || '9999') < (b.currDate || '9999') ? -1 : 1 }).forEach(function (t) {
      var live = t.st === 'wait' || (t.st === 'done' ? (t.doneDate && t.doneDate >= td) : true);
      if (live) seen[t.siteId || 'other'] = 1;
      if (!inSel(t)) return;
      var m = that.meta(d, t, filtered);
      if (t.st === 'wait') {
        waitL.push(Object.assign({}, t, { m: m, wd: Math.max(0, S.diff(td, t.waitSince || t.currDate)), pend: false }));
        return;
      }
      // 待定(无日期)的待办:进"进行中·挂起·待定"区,带"待定"标签
      if (t.st === 'todo' && !t.currDate) {
        waitL.push(Object.assign({}, t, { m: m, wd: 0, pend: true }));
        return;
      }
      if (t.st === 'done') {
        if (t.doneDate && t.doneDate < td) {
          var k = t.doneDate.slice(0, 7);
          if (!archMap[k]) archMap[k] = [];
          archMap[k].push(Object.assign({}, t, { m: m, dTxt: S.fmtShort(t.doneDate) + ' 完成' }));
        } else {
          todayL.push(Object.assign({}, t, { m: m, doneToday: true }));
        }
        return;
      }
      if (!t.currDate) { return }
      if (t.currDate <= td) {
        todayL.push(Object.assign({}, t, { m: m, od: t.currDate < td ? S.diff(td, t.currDate) : 0 }));
      } else {
        upL.push(Object.assign({}, t, { m: m, left: S.diff(t.currDate, td), dTxt: S.fmt(t.currDate) }));
      }
    });
    var archN = 0;
    var arch = Object.keys(archMap).sort().reverse().map(function (k) {
      archN += archMap[k].length;
      return { k: k, label: k.replace('-', '年') + '月', items: archMap[k] };
    });
    var todo = todayL.filter(function (t) { return !t.doneToday }).length;
    // 筛选条:只列当前有任务(今日/挂起/即将到来)的工地 + 其他
    var chips = d.sites.filter(function (x) { return x.status === 'active' && seen[x.id] })
      .map(function (x) { return { id: x.id, name: x.name, on: sel.indexOf(x.id) >= 0 } });
    if (seen.other) chips.push({ id: 'other', name: '其他', on: sel.indexOf('other') >= 0 });
    // 选中工地的现状便签
    var siteNotes = sel.map(function (id) { var x = S.getSite(d, id); return x && x.note ? { id: id, name: x.name, note: x.note } : null })
      .filter(function (x) { return x });
    var one = (sel.length === 1 && sel[0] !== 'other') ? S.getSite(d, sel[0]) : null;
    this.setData({
      dateTxt: S.fmt(td), todayL: todayL, waitL: waitL, upL: upL, arch: arch, archN: archN,
      count: todo + ' 项待办 · ' + waitL.filter(function (x) { return !x.pend }).length + ' 挂起 · ' + waitL.filter(function (x) { return x.pend }).length + ' 待定',
      notes: S.notes().map(function (n) { return { k: n._id || n.ts, text: n.text } }),
      chips: chips, sel: sel, filtered: filtered, siteNotes: siteNotes,
      addLabel: one ? ('＋ 给 ' + one.name + ' 添加任务') : '＋ 添加任务'
    });
  },
  tapChip: function (e) {
    var id = e.currentTarget.dataset.id; var sel = S.getFilter();
    if (id === 'all') sel = [];
    else { var i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else sel.push(id); }
    S.setFilter(sel); this.build();
  },
  tap: function (e) {
    var that = this; var id = e.currentTarget.dataset.id;
    S.askQuota(function () { S.showTaskMenu(id, function () { that.build() }) });
  },
  gotNotes: function () { var that = this; S.clearNotes(function () { that.build() }); this.setData({ notes: [] }) },
  tglArch: function () { this.setData({ archOpen: !this.data.archOpen }) },
  add: function () {
    var sel = S.getFilter();
    var q = (sel.length === 1 && sel[0] !== 'other') ? ('?siteId=' + sel[0]) : '';
    wx.navigateTo({ url: '/pages/taskedit/taskedit' + q });
  }
});
