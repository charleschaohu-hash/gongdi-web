var S = require('../../utils/store.js');
var SCOPES = [{ v: 'none', l: '不提醒' }, { v: 'mine', l: '只提醒我建的任务' }, { v: 'all', l: '所有人的任务动态' }];
var MODES = [{ v: 'now', l: '即时推送(一条一个额度)' }, { v: 'digest', l: '每晚8点汇总一条(省额度)' }];
Page({
  data: {
    tpl: [], quick: [], newTpl: '', newQk: '', meName: '', meRole: '', members: [],
    scopeNames: SCOPES.map(function (x) { return x.l }), modeNames: MODES.map(function (x) { return x.l }),
    scopeIdx: 1, modeIdx: 0, quota: 0, cronTxt: '检查中…'
  },
  onShow: function () {
    var d = S.load(); var m = S.me(); var p = (m && m.prefs) || {};
    var si = 1; SCOPES.forEach(function (x, i) { if (x.v === p.scope) si = i });
    var mi = 0; MODES.forEach(function (x, i) { if (x.v === p.mode) mi = i });
    this.setData({
      tpl: d.template.map(function (t, i) { return { k: i + ':' + t, t: t } }),
      quick: d.quick.map(function (t, i) { return { k: i + ':' + t, t: t } }),
      meName: m ? m.name : '(未连接云端)', meRole: m ? (m.role === 'admin' ? '管理员' : '员工') : '',
      isAdmin: S.isAdmin(), myOpen: S.myOpen(),
      members: S.membersList(),
      scopeIdx: si, modeIdx: mi, quota: (m && m.quota) || 0
    });
    var that = this;
    S.cronStatus(function (r) {
      if (!r.ok) return that.setData({ cronTxt: '无法读取' });
      if (!r.last) return that.setData({ cronTxt: '尚未运行 —— 触发器可能没部署,看说明' });
      var min = Math.round((Date.now() - r.last) / 60000);
      that.setData({ cronTxt: min < 20 ? ('正常 · ' + min + ' 分钟前运行过') : ('已 ' + min + ' 分钟未运行,触发器可能失效') });
    });
  },
  inTpl: function (e) { this.setData({ newTpl: e.detail.value }) },
  inQk: function (e) { this.setData({ newQk: e.detail.value }) },
  rmTpl: function (e) { var d = S.load(); d.template.splice(e.currentTarget.dataset.i, 1); S.persist(); S.saveTemplate(); this.onShow(); },
  addTpl: function () {
    var v = this.data.newTpl.trim(); if (!v) return;
    var d = S.load(); d.template.push(v); S.persist(); S.saveTemplate();
    this.setData({ newTpl: '' }); this.onShow();
  },
  rmQk: function (e) { var d = S.load(); d.quick.splice(e.currentTarget.dataset.i, 1); S.persist(); S.saveQuick(); this.onShow(); },
  addQk: function () {
    var v = this.data.newQk.trim(); if (!v) return;
    var d = S.load(); d.quick.push(v); S.persist(); S.saveQuick();
    this.setData({ newQk: '' }); this.onShow();
  },
  pickScope: function (e) { this.setData({ scopeIdx: +e.detail.value }); this.savePrefs() },
  pickMode: function (e) { this.setData({ modeIdx: +e.detail.value }); this.savePrefs() },
  savePrefs: function () {
    S.setPrefs(SCOPES[this.data.scopeIdx].v, MODES[this.data.modeIdx].v, function (r) {
      wx.showToast({ title: r.ok ? '已保存' : '保存失败,检查网络', icon: 'none' });
    });
  },
  addQuota: function () {
    var that = this;
    S.askQuota(function () {
      setTimeout(function () {
        var m = S.me(); that.setData({ quota: (m && m.quota) || 0 });
      }, 800);
    }, true);
  },
  rename: function () {
    var that = this;
    wx.showModal({
      title: '修改我的名字', editable: true, placeholderText: '给同事看的名字',
      content: (S.me() || {}).name || '',
      success: function (r) {
        if (!r.confirm) return;
        var nm = (r.content || '').trim();
        if (!nm) return;
        S.renameMe(nm, function (res) {
          that.onShow();
          wx.showToast({ title: res.ok ? '已改名' : '改名失败,检查网络', icon: 'none' });
        });
      }
    });
  },
  invite: function () {
    var roles = [{ v: 'member', l: '员工(只看指派给他的任务)' }, { v: 'admin', l: '管理员(和我一样,全部可见可改)' }];
    wx.showActionSheet({
      itemList: roles.map(function (r) { return r.l }),
      success: function (res) {
        var role = roles[res.tapIndex].v;
        S.makeInvite(role, function (r) {
          if (!r.ok) return wx.showToast({ title: r.reason === 'not_admin' ? '仅管理员可发邀请码' : '生成失败,检查网络', icon: 'none' });
          wx.showModal({
            title: '邀请码:' + r.code,
            content: '角色:' + (role === 'admin' ? '管理员' : '员工') + '。24小时内有效,一码一人。把这个码发给对方,他打开小程序输入即可进入。',
            showCancel: false, confirmText: '好'
          });
        });
      }
    });
  },
  memberMenu: function (e) {
    var that = this; var oid = e.currentTarget.dataset.oid;
    if (!S.isAdmin() || oid === S.myOpen()) return;
    var m = S.membersList().filter(function (x) { return x.openid === oid })[0]; if (!m) return;
    var opts = [];
    opts.push(m.role === 'admin' ? { l: '改为员工(只看指派任务)', p: { role: 'member' } } : { l: '改为管理员(全部可见可改)', p: { role: 'admin' } });
    opts.push(m.status === 'active' ? { l: '停用此成员', p: { status: 'disabled' } } : { l: '恢复此成员', p: { status: 'active' } });
    wx.showActionSheet({
      itemList: opts.map(function (o) { return o.l }),
      success: function (res) {
        var o = opts[res.tapIndex];
        S.setMember(oid, o.p, function (r) {
          that.onShow();
          wx.showToast({ title: r.ok ? '已更新(对方下次打开生效)' : '操作失败,检查网络', icon: 'none' });
        });
      }
    });
  },
  refresh: function () {
    var that = this;
    wx.showToast({ title: '同步中…', icon: 'none' });
    S.refresh(function (r) {
      that.onShow();
      var msg;
      if (r.ok && !r.offline) msg = '已与云端同步';
      else if (r.reason === 'not_member') msg = '无权限:此微信不在成员名单';
      else if (r.reason === 'disabled') msg = '账号已被停用';
      else if (r.reason === 'busy') msg = '正在同步,稍等';
      else msg = '连不上云端,稍后自动重试';
      wx.showToast({ title: msg, icon: 'none' });
    });
  },
  importReal: function () {
    var that = this;
    wx.showModal({
      title: '导入真实数据',
      content: '将写入十个工地的档案与8月日志到云端(与现有云端数据合并,同ID覆盖),确定?',
      success: function (r) {
        if (!r.confirm) return;
        S.importReal(); that.onShow();
        wx.showToast({ title: '已导入并开始上云', icon: 'none' });
      }
    });
  },
  migrate: function () {
    var that = this;
    wx.showModal({
      title: '迁移旧数据',
      content: '把这台设备上本地版(v3)的数据推送到云端,确定?',
      success: function (r) {
        if (!r.confirm) return;
        S.migrateOld(function (found) {
          that.onShow();
          wx.showToast({ title: found ? '已开始迁移上云' : '没有找到本地旧数据', icon: 'none' });
        });
      }
    });
  }
});
