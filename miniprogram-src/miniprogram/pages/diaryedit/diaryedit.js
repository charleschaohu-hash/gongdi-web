var S = require('../../utils/store');
Page({
  data: { date: '', dateTxt: '', weather: '', blocks: [], tomorrow: [], newTm: '', waits: [], ro: false, authorName: '' },
  onLoad: function (opt) {
    var e = null;
    if (opt.id) { e = S.getDiaryById(opt.id); this.date = e ? e.date : (opt.date || S.today()); }
    else { this.date = opt.date || S.today(); e = S.getDiary(this.date); }
    this.entry = e;
    this.loadEntry();
  },
  onShow: function () { this.reloadTomorrow(); this.refreshSys() },
  loadEntry: function () {
    var e = this.entry; var mo = S.myOpen();
    var ro = !!(e && e.author && e.author !== mo);
    var blocks = e ? (e.blocks || []) : [];
    this.setData({
      date: this.date, dateTxt: S.fmt(this.date), ro: ro,
      authorName: ro ? S.memberName(e.author) : '',
      weather: e ? (e.weather || '') : '',
      blocks: blocks.map(function (b) { return Object.assign({}, b) }),
      tomorrow: this.withKeys(e ? (e.tomorrow || []) : [])
    });
    wx.setNavigationBarTitle({ title: ro ? (this.data.authorName + '的日记') : '日记' });
    this.refreshSys();
  },
  withKeys: function (arr) { return arr.map(function (x, i) { return Object.assign({ k: 'm' + i + '-' + (x.text || '').slice(0, 8) }, x) }) },
  // 从任务页返回时,明日事项的 ✓ 可能已被回写,只刷新这一块,不动正在编辑的板块
  reloadTomorrow: function () {
    if (!this.entry || !this.entry.id) return;
    var e = S.getDiaryById(this.entry.id); if (!e) return;
    this.entry = e;
    this.setData({ tomorrow: this.withKeys(e.tomorrow || []) });
  },
  refreshSys: function () {
    var d = S.load(); var that = this; var td = S.today();
    var blocks = this.data.blocks.map(function (b) {
      var nb = Object.assign({}, b);
      nb.siteName = b.siteId === 'other' ? '其他' : (S.getSite(d, b.siteId) || {}).name || '';
      nb.sys = b.siteId === 'other' ? [] : S.sysLines(d, that.date, b.siteId).map(function (t, i) { return { k: i, t: t } });
      return nb;
    });
    var waits = d.tasks.filter(function (t) { return t.st === 'wait' }).map(function (t) {
      return {
        id: t.id, name: t.name, m: S.taskMeta(d, t),
        wd: Math.max(0, S.diff(td, t.waitSince || t.currDate))
      };
    });
    this.setData({ blocks: blocks, waits: waits });
  },
  inWeather: function (e) { this.setData({ weather: e.detail.value }) },
  inB: function (e) {
    var i = e.currentTarget.dataset.i, f = e.currentTarget.dataset.f;
    var k = 'blocks[' + i + '].' + f; var o = {}; o[k] = e.detail.value; this.setData(o);
  },
  addBlock: function () {
    if (this.data.ro) return;
    var that = this; var d = S.load();
    var opts = d.sites.filter(function (s) { return s.status === 'active' })
      .map(function (s) { return { id: s.id, name: s.name } });
    opts.push({ id: 'other', name: '其他' });
    var used = this.data.blocks.map(function (b) { return b.siteId });
    var avail = opts.filter(function (o) { return used.indexOf(o.id) < 0 });
    if (!avail.length) return wx.showToast({ title: '所有工地都已添加', icon: 'none' });
    var put = function (o) {
      var b = { siteId: o.id, workers: '', events: '', orders: '', spend: '', showing: '' };
      that.setData({ blocks: that.data.blocks.concat([b]) });
      that.refreshSys();
    };
    // 还没有工地时不弹选择器,直接给"其他"并提示
    if (opts.length === 1) {
      put(avail[0]);
      return wx.showToast({ title: '还没有工地,先记在「其他」;新建工地后可按工地分块', icon: 'none', duration: 2500 });
    }
    S.pickOne(avail.map(function (o) { return o.name }), function (idx) { put(avail[idx]) });
  },
  rmBlock: function (e) {
    if (this.data.ro) return;
    var that = this; var i = e.currentTarget.dataset.i;
    wx.showModal({
      title: '移除板块', content: '移除这个工地板块?已写的内容会丢失。',
      success: function (r) {
        if (!r.confirm) return;
        var bs = that.data.blocks.slice(); bs.splice(i, 1);
        that.setData({ blocks: bs }); that.refreshSys();
      }
    });
  },
  inTm: function (e) { this.setData({ newTm: e.detail.value }) },
  addTm: function () {
    if (this.data.ro) return;
    var v = this.data.newTm.trim(); if (!v) return;
    this.setData({ tomorrow: this.withKeys(this.data.tomorrow.concat([{ text: v, cv: false }])), newTm: '' });
    this.saveEntry(true);
  },
  rmTm: function (e) {
    if (this.data.ro) return;
    var i = e.currentTarget.dataset.i;
    var tm = this.data.tomorrow.slice(); tm.splice(i, 1);
    this.setData({ tomorrow: this.withKeys(tm) }); this.saveEntry(true);
  },
  cvTm: function (e) {
    if (this.data.ro) return;
    var i = e.currentTarget.dataset.i;
    var tm = this.data.tomorrow;
    if (tm[i].cv) return;
    var entry = this.saveEntry(true);   // 先保证日记有 id,任务建成后回写
    wx.navigateTo({
      url: '/pages/taskedit/taskedit?name=' + encodeURIComponent(tm[i].text) +
        '&date=' + S.addDays(this.date, 1) + '&tmDiary=' + entry.id + '&tmIdx=' + i
    });
  },
  saveEntry: function (silent) {
    if (this.data.ro) return this.entry;
    var o = this.data;
    var entry = S.saveDiary({
      id: this.entry ? this.entry.id : undefined,
      author: this.entry ? this.entry.author : undefined,
      date: this.date, weather: o.weather.trim(),
      blocks: o.blocks.map(function (b) {
        return {
          siteId: b.siteId, workers: (b.workers || '').trim(), events: (b.events || '').trim(),
          orders: (b.orders || '').trim(), spend: (b.spend || '').trim(), showing: (b.showing || '').trim()
        };
      }),
      tomorrow: o.tomorrow.map(function (x) { return { text: x.text, cv: !!x.cv, taskId: x.taskId || '' } })
    });
    this.entry = entry;
    if (!silent) wx.showToast({ title: '日记已保存', icon: 'none' });
    return entry;
  },
  save: function () {
    var that = this;
    S.askQuota(function () { that.saveEntry(false) });
  }
});
