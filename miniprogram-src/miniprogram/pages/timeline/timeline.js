var S = require('../../utils/store');
Page({
  data: { site: null, tops: [], start: '', delay: 0 },
  onLoad: function (opt) { this.siteId = opt.siteId; this.exp = {} },
  onShow: function () { this.build() },
  tv: function (d, stageId) {
    var td = S.today();
    return d.tasks.filter(function (t) { return t.stageId === stageId })
      .sort(function (a, b) { return (a.currDate || '9999') < (b.currDate || '9999') ? -1 : 1 })
      .map(function (t) {
        return Object.assign({}, t, {
          dateTxt: t.st === 'done' ? (S.fmtShort(t.doneDate) + ' 完成') : (t.currDate ? ('预计 ' + S.fmt(t.currDate)) : '日期待定'),
          isToday: t.currDate === td,
          who: (t.assignee && t.assignee !== S.myOpen()) ? S.memberName(t.assignee) : ''
        });
      });
  },
  sub: function (d, st) {
    var ts = d.tasks.filter(function (t) { return t.stageId === st.id });
    if (!ts.length) return '未排期 · 点开添加任务';
    var un = ts.filter(function (t) { return t.st !== 'done' });
    if (!un.length) return ts.length + '个任务 · 全部完成';
    var dated = un.filter(function (t) { return t.currDate })
      .sort(function (a, b) { return a.currDate < b.currDate ? -1 : 1 });
    if (!dated.length) return un.length + '个进行中 · 日期待定';
    return un.length + '个进行中 · 最近 ' + S.fmtShort(dated[0].currDate);
  },
  build: function () {
    var that = this; var d = S.load();
    var s = S.getSite(d, this.siteId);
    if (!s) return wx.navigateBack();
    var tops = d.stages
      .filter(function (x) { return x.siteId === s.id && !x.parent })
      .sort(function (a, b) { return a.order - b.order })
      .map(function (st) {
        var kids = d.stages.filter(function (k) { return k.parent === st.id })
          .map(function (k) { return { stage: k, tasks: that.tv(d, k.id) } });
        return {
          stage: st, kids: kids, tasks: that.tv(d, st.id),
          stTxt: st.status === 'done' ? '已完成' : (st.status === 'current' ? '进行中' : '未开始'),
          open: !!that.exp[st.id], sub: that.sub(d, st),
          kn: kids.map(function (k) { return k.stage.name }).join('、')
        };
      });
    wx.setNavigationBarTitle({ title: s.name });
    this.setData({
      isAdmin: S.isAdmin(),
      site: s, tops: tops, start: s.start ? S.fmtShort(s.start) : '',
      delay: S.siteDelay(d, s.id),
      note: s.note || '', noteDate: s.noteDate ? S.fmtShort(s.noteDate) : ''
    });
  },
  editNote: function () {
    var that = this;
    if (!S.isAdmin()) return;
    wx.showModal({
      title: '现状便签', editable: true, placeholderText: '一句话描述这个工地现在的状态',
      content: this.data.note || '',
      success: function (r) {
        if (r.confirm) { S.updateSiteNote(that.siteId, (r.content || '').trim()); that.build(); }
      }
    });
  },
  tgl: function (e) { var id = e.currentTarget.dataset.id; this.exp[id] = !this.exp[id]; this.build() },
  addTask: function (e) {
    wx.navigateTo({ url: '/pages/taskedit/taskedit?siteId=' + this.siteId + '&stageId=' + e.currentTarget.dataset.id });
  },
  tapTask: function (e) {
    var that = this; var id = e.currentTarget.dataset.id;
    S.askQuota(function () { S.showTaskMenu(id, function () { that.build() }) });
  },
  stageMenu: function (e) { var that = this; if (!S.isAdmin()) return; S.showStageMenu(e.currentTarget.dataset.id, function () { that.build() }) },
  merge: function (e) {
    var that = this; var id = e.currentTarget.dataset.id; var d = S.load();
    if (!S.isAdmin()) return;
    if (d.stages.some(function (x) { return x.parent === id })) {
      return wx.showToast({ title: '它带着子阶段,先恢复它们', icon: 'none' });
    }
    var opts = d.stages.filter(function (x) {
      return x.siteId === that.siteId && !x.parent && x.id !== id && x.status !== 'done';
    });
    if (!opts.length) return;
    S.pickOne(opts.map(function (o) { return o.name }), function (idx) {
      var tg = opts[idx];
      S.mergeStage(id, tg.id); that.exp[tg.id] = true; that.build();
      wx.showToast({ title: '已并入「' + tg.name + '」', icon: 'none' });
    });
  },
  unmerge: function (e) { if (!S.isAdmin()) return; S.unmergeStage(e.currentTarget.dataset.id); this.build() }
});
