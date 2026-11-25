var S = require('../../utils/store.js');
Page({
  data: { code: '', name: '', busy: false, reason: '', err: '' },
  onLoad: function (opt) {
    this.setData({ reason: opt.reason || '', err: S.getLastError() });
  },
  inCode: function (e) { this.setData({ code: e.detail.value }) },
  inName: function (e) { this.setData({ name: e.detail.value }) },
  retry: function () {
    var that = this;
    this.setData({ busy: true });
    S.boot(function (r) {
      that.setData({ busy: false, err: S.getLastError() });
      if (r.ok && !r.offline) { wx.reLaunch({ url: '/pages/sites/sites' }) }
      else if (r.reason && r.reason !== 'offline') { that.setData({ reason: r.reason }) }
      else { wx.showToast({ title: '还是连不上,报错见下方灰字', icon: 'none' }) }
    });
  },
  submit: function () {
    var that = this;
    var code = this.data.code.trim();
    if (!code) return wx.showToast({ title: '输入邀请码', icon: 'none' });
    this.setData({ busy: true });
    S.redeem(code, that.data.name.trim(), function (r) {
      if (!r.ok) {
        that.setData({ busy: false, err: S.getLastError() });
        var msg = r.reason === 'bad_code' ? '邀请码不存在' : (r.reason === 'used' ? '邀请码已被使用' : (r.reason === 'expired' ? '邀请码已过期' : '网络异常,再试一次'));
        return wx.showToast({ title: msg, icon: 'none' });
      }
      S.boot(function (b) {
        that.setData({ busy: false, err: S.getLastError() });
        if (b.ok && !b.offline) { wx.reLaunch({ url: '/pages/sites/sites' }) }
        else { wx.showToast({ title: '进入失败,看下方报错', icon: 'none' }) }
      });
    });
  }
});
