var S = require('../../utils/store');
Page({
  data: { list: [], filters: [], filterId: 'all', hasToday: false },
  onShow: function () { this.build() },
  build: function () {
    var d = S.load(); var td = S.today(); var fid = this.data.filterId; var mo = S.myOpen();
    var filters = [{ id: 'all', name: '全部' }].concat(
      d.sites.filter(function (s) { return s.status === 'active' })
        .map(function (s) { return { id: s.id, name: s.name } })
    );
    var list = d.diaries.slice()
      .sort(function (a, b) { return a.date === b.date ? ((a.author || '') < (b.author || '') ? -1 : 1) : (a.date < b.date ? 1 : -1) })
      .filter(function (e) {
        if (fid === 'all') return true;
        return (e.blocks || []).some(function (b) { return b.siteId === fid });
      })
      .map(function (e) {
        var names = (e.blocks || []).map(function (b) {
          if (b.siteId === 'other') return '其他';
          var s = S.getSite(d, b.siteId); return s ? s.name : '';
        }).filter(function (x) { return x });
        var snip = '';
        (e.blocks || []).forEach(function (b) { if (!snip && b.events) snip = b.events });
        var mine = !e.author || e.author === mo;
        return {
          id: e.id, date: e.date, dateTxt: S.fmt(e.date), weather: e.weather || '',
          author: mine ? '' : S.memberName(e.author),
          sites: names.join(' · ') || '未记工地',
          snip: snip.length > 46 ? snip.slice(0, 46) + '…' : snip,
          tm: (e.tomorrow || []).length
        };
      });
    this.setData({ list: list, filters: filters, hasToday: !!S.getDiary(td) });
  },
  setFilter: function (e) { this.setData({ filterId: e.currentTarget.dataset.id }); this.build() },
  writeToday: function () { wx.navigateTo({ url: '/pages/diaryedit/diaryedit?date=' + S.today() }) },
  open: function (e) { wx.navigateTo({ url: '/pages/diaryedit/diaryedit?id=' + e.currentTarget.dataset.id }) }
});
