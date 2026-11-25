var S = require('../../utils/store');
Page({
  data: { name: '', addr: '', date: '', stages: [], stageRows: [], newStg: '' },
  rows: function (a) { return a.map(function (t, i) { return { k: i + ':' + t, t: t } }) },
  onLoad: function () {
    var d = S.load();
    this.setData({ date: S.today(), stages: d.template.slice(), stageRows: this.rows(d.template) });
  },
  inName: function (e) { this.setData({ name: e.detail.value }) },
  inAddr: function (e) { this.setData({ addr: e.detail.value }) },
  inNew: function (e) { this.setData({ newStg: e.detail.value }) },
  pickDate: function (e) { this.setData({ date: e.detail.value }) },
  rm: function (e) {
    var i = e.currentTarget.dataset.i; var st = this.data.stages.slice();
    st.splice(i, 1); this.setData({ stages: st, stageRows: this.rows(st) });
  },
  addStg: function () {
    var v = this.data.newStg.trim(); if (!v) return;
    var st = this.data.stages.concat([v]);
    this.setData({ stages: st, stageRows: this.rows(st), newStg: '' });
  },
  create: function () {
    var o = this.data;
    if (!o.name.trim()) return wx.showToast({ title: '先填工地名称', icon: 'none' });
    if (!o.stages.length) return wx.showToast({ title: '至少保留一个阶段', icon: 'none' });
    var id = S.createSite({ name: o.name.trim(), addr: o.addr.trim(), start: o.date, stages: o.stages });
    wx.redirectTo({ url: '/pages/timeline/timeline?siteId=' + id });
  }
});
