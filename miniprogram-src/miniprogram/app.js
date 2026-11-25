var S = require('./utils/store.js');
App({
  onLaunch: function () {
    if (!wx.cloud) { console.error('基础库过低,不支持云开发'); return }
    wx.cloud.init({ env: 'YOUR_CLOUD_ENV_ID', traceUser: true });
    S.boot(function (r) {
      if (!r.ok) {
        wx.reLaunch({ url: '/pages/noaccess/noaccess?reason=' + (r.reason || '') });
      } else if (r.offline) {
        wx.showToast({ title: '离线模式:改动会在联网后自动同步', icon: 'none', duration: 2500 });
      }
    });
  },
  // 热启动:先补传离线队列,再看是否需要静默拉一次云端(超过5分钟)
  onShow: function () { S.flush(); S.maybeRefresh(); }
});
