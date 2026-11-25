var S = require('../../utils/store');
Page({
  data: { title: '', cells: [], selTxt: '', list: [], chips: [], filtered: false },
  onLoad: function () {
    var t = new Date(); this.y = t.getFullYear(); this.m = t.getMonth(); this.sel = S.today();
  },
  onShow: function () { this.build() },
  build: function () {
    var d = S.load(); var td = S.today(); var y = this.y, m = this.m, sel = this.sel;
    var fsel = S.getFilter(); var filtered = fsel.length > 0;
    var mon = y + '-' + (m + 1 < 10 ? '0' : '') + (m + 1);
    var seen = {};
    d.tasks.forEach(function (t) {
      var ds = t.st === 'done' ? t.doneDate : t.currDate;
      if (ds && ds.slice(0, 7) === mon) seen[t.siteId || 'other'] = 1;
    });
    var tasks = d.tasks.filter(function (t) { return !filtered || fsel.indexOf(t.siteId || 'other') >= 0 });
    var first = new Date(y, m, 1);
    var startW = (first.getDay() + 6) % 7; // 周一开头
    var days = new Date(y, m + 1, 0).getDate();
    var cells = [];
    for (var i = 0; i < startW; i++) cells.push({ blank: true, idx: 'b' + i });
    for (var dd = 1; dd <= days; dd++) {
      var ds = S.isoOf(y, m, dd); var dots = [];
      tasks.forEach(function (t) {
        var on = t.st === 'done' ? (t.doneDate === ds) : (t.st !== 'wait' && t.currDate && t.currDate === ds);
        if (!on || dots.length >= 3) return;
        var c = t.st === 'done' ? '#5DCAA5' : (ds < td ? '#E24B4A' : (ds === td ? '#EF9F27' : '#7F77DD'));
        dots.push({ k: dots.length, c: c });
      });
      cells.push({ d: dd, ds: ds, dots: dots, isToday: ds === td, sel: ds === sel, idx: ds });
    }
    var list = tasks.filter(function (t) {
      return t.st === 'done' ? t.doneDate === sel : (t.st !== 'wait' && t.currDate && t.currDate === sel);
    }).map(function (t) {
      var g = t.stageId ? S.getStage(d, t.stageId) : null;
      return Object.assign({}, t, {
        m: filtered ? (g ? g.name : (t.siteId === 'other' ? '其他事项' : '')) : S.taskMeta(d, t),
        stTxt: t.st === 'done' ? '已完成' : (t.currDate < td ? '已逾期' : (t.currDate === td ? '今日' : '计划'))
      });
    });
    var chips = d.sites.filter(function (x) { return x.status === 'active' && seen[x.id] })
      .map(function (x) { return { id: x.id, name: x.name, on: fsel.indexOf(x.id) >= 0 } });
    if (seen.other) chips.push({ id: 'other', name: '其他', on: fsel.indexOf('other') >= 0 });
    this.setData({ title: y + '年' + (m + 1) + '月', cells: cells, selTxt: S.fmt(sel), list: list, chips: chips, filtered: filtered });
  },
  tapChip: function (e) {
    var id = e.currentTarget.dataset.id; var sel = S.getFilter();
    if (id === 'all') sel = [];
    else { var i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else sel.push(id); }
    S.setFilter(sel); this.build();
  },
  prev: function () { this.m--; if (this.m < 0) { this.m = 11; this.y-- } this.build() },
  next: function () { this.m++; if (this.m > 11) { this.m = 0; this.y++ } this.build() },
  tapDay: function (e) {
    var ds = e.currentTarget.dataset.ds; if (!ds) return;
    this.sel = ds; this.build();
  },
  tapTask: function (e) {
    var that = this; var id = e.currentTarget.dataset.id;
    S.askQuota(function () { S.showTaskMenu(id, function () { that.build() }) });
  }
});
