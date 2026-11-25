var S = require('../../utils/store');
Page({
  data: {
    dateOnly: false, isEdit: false, isProc: false, hasDate: false,
    name: '', desc: '', date: '', proc: false, reason: '',
    siteOpts: [], siteNames: [], siteIdx: 0,
    stages: [], stageNames: [], stageIdx: 0,
    remindNames: [], remindIdx: 0, remindDate: '', remindTime: '08:00',
    recips: [], showRecips: false,
    isAdmin: false, assignOpts: [], assignNames: [], assignIdx: 0
  },
  onLoad: function (opt) {
    var d = S.load(); this.tid = opt.id || null;
    this.tmDiary = opt.tmDiary || ''; this.tmIdx = opt.tmIdx != null ? +opt.tmIdx : -1;
    var t = opt.id ? S.getTask(d, opt.id) : null;
    var dateOnly = opt.dateOnly === '1';
    var siteOpts = d.sites.filter(function (s) { return s.status === 'active' })
      .map(function (s) { return { id: s.id, name: s.name } });
    siteOpts.push({ id: 'other', name: '其他(不挂工地)' });
    var siteId = t ? t.siteId : (opt.siteId || siteOpts[0].id);
    var stageId = t ? t.stageId : (opt.stageId || null);
    var stages = this.stageOpts(d, siteId);
    var si = 0; siteOpts.forEach(function (s, i) { if (s.id === siteId) si = i });
    var gi = 0; stages.forEach(function (s, i) { if (s.id === stageId) gi = i });

    // 提醒
    var rv = t ? (t.remind || 'none') : 'none';
    var ri = 0; S.REMIND.forEach(function (o, i) { if (o.v === rv) ri = i });
    var rc = (t && t.remindCustom) ? t.remindCustom.split(' ') : [];
    // 收件人:团队有别人时才显示;默认建任务人(新建=我)
    var meId = S.myOpen();
    var members = S.membersList().filter(function (m) { return m.status === 'active' });
    var sel = (t && t.remindTo && t.remindTo.length) ? t.remindTo : [t ? (t.createdBy || meId) : meId];
    var recips = members.map(function (m) {
      return { openid: m.openid, name: m.openid === meId ? m.name + '(我)' : m.name, on: sel.indexOf(m.openid) >= 0 };
    });

    // 指派(仅管理员可见可改;员工建的任务自动归自己)
    var assignOpts = [{ openid: '', name: '未指派(仅管理员角色可见)' }].concat(
      members.map(function (m) { return { openid: m.openid, name: m.openid === meId ? m.name + '(我)' : m.name + (m.role === 'admin' ? '' : ' · 员工') } })
    );
    var ai = 0; assignOpts.forEach(function (o, i) { if (t && o.openid === (t.assignee || '')) ai = i });

    this.setData({
      isAdmin: S.isAdmin(), assignOpts: assignOpts, assignNames: assignOpts.map(function (o) { return o.name }), assignIdx: ai,
      dateOnly: dateOnly, isEdit: !!t, isProc: !!(t && t.proc), hasDate: !!(t && t.currDate),
      siteOpts: siteOpts, siteNames: siteOpts.map(function (s) { return s.name }), siteIdx: si,
      stages: stages, stageNames: stages.map(function (s) { return s.label }), stageIdx: gi,
      name: t ? t.name : (opt.name ? decodeURIComponent(opt.name) : ''),
      desc: t ? t.desc : '',
      proc: t ? t.proc : false,
      noDate: t ? !t.currDate : false,
      date: (t && t.currDate) ? t.currDate : (opt.date || S.today()),
      remindNames: S.REMIND.map(function (o) { return o.l }), remindIdx: ri,
      remindDate: rc[0] || (t && t.currDate) || opt.date || S.today(), remindTime: rc[1] || '08:00',
      recips: recips, showRecips: members.length >= 2
    });
    wx.setNavigationBarTitle({ title: dateOnly ? '修改日期' : (t ? '编辑任务' : '添加任务') });
  },
  stageOpts: function (d, siteId) {
    if (siteId === 'other') return [];
    return d.stages.filter(function (s) { return s.siteId === siteId })
      .sort(function (a, b) { return a.order - b.order })
      .map(function (s) { return { id: s.id, label: (s.parent ? '↳ ' : '') + s.name } });
  },
  pickSite: function (e) {
    var i = +e.detail.value; var d = S.load();
    var st = this.stageOpts(d, this.data.siteOpts[i].id);
    this.setData({ siteIdx: i, stages: st, stageNames: st.map(function (s) { return s.label }), stageIdx: 0 });
  },
  pickStage: function (e) { this.setData({ stageIdx: +e.detail.value }) },
  pickDate: function (e) { this.setData({ date: e.detail.value }) },
  inName: function (e) { this.setData({ name: e.detail.value }) },
  inDesc: function (e) { this.setData({ desc: e.detail.value }) },
  inReason: function (e) { this.setData({ reason: e.detail.value }) },
  togProc: function (e) { this.setData({ proc: e.detail.value }) },
  togNoDate: function (e) { this.setData({ noDate: e.detail.value }) },
  pickRemind: function (e) { this.setData({ remindIdx: +e.detail.value }) },
  pickAssign: function (e) {
    var i = +e.detail.value; var o = { assignIdx: i };
    // 指派给别人时,把他勾进提醒收件人
    var oid = this.data.assignOpts[i].openid;
    if (oid) this.data.recips.forEach(function (r, idx) { if (r.openid === oid) o['recips[' + idx + '].on'] = true });
    this.setData(o);
  },
  pickRemindDate: function (e) { this.setData({ remindDate: e.detail.value }) },
  pickRemindTime: function (e) { this.setData({ remindTime: e.detail.value }) },
  togRecip: function (e) {
    var i = e.currentTarget.dataset.i; var k = 'recips[' + i + '].on'; var o = {};
    o[k] = !this.data.recips[i].on; this.setData(o);
  },
  save: function () {
    var that = this;
    // 点保存这一下顺便静默申请一条推送额度(勾过"总是保持"后无感)
    S.askQuota(function () { that.doSave() });
  },
  doSave: function () {
    var o = this.data;
    if (o.dateOnly) {
      var n = S.changeDate(this.tid, o.date, o.reason.trim());
      wx.showToast({ title: n > 0 ? ('已顺延' + n + '天,延迟已记录') : '日期已更新', icon: 'none' });
      return wx.navigateBack();
    }
    if (!o.name.trim()) return wx.showToast({ title: '先填任务名', icon: 'none' });
    var siteId = o.siteOpts[o.siteIdx].id; var stageId = null;
    if (siteId !== 'other') {
      if (!o.stages.length) return wx.showToast({ title: '该工地没有阶段', icon: 'none' });
      stageId = o.stages[o.stageIdx].id;
    }
    // 已有日期的工序任务不能改回待定(否则可以绕过延迟记录)
    var noDate = o.noDate && !(o.isProc && o.hasDate);
    var dv = noDate ? '' : o.date;
    var remind = S.REMIND[o.remindIdx].v;
    if (noDate && remind !== 'none' && remind !== 'custom') {
      return wx.showToast({ title: '待定任务只能选"自定义时间"或不提醒', icon: 'none' });
    }
    var remindCustom = remind === 'custom' ? (o.remindDate + ' ' + o.remindTime) : '';
    var remindTo = o.showRecips ? o.recips.filter(function (r) { return r.on }).map(function (r) { return r.openid }) : [];
    if (remind !== 'none' && o.showRecips && !remindTo.length) return wx.showToast({ title: '至少选一个提醒收件人', icon: 'none' });

    var assignee = o.isAdmin ? o.assignOpts[o.assignIdx].openid : S.myOpen();
    if (this.tid) {
      S.updateTask(this.tid, { name: o.name.trim(), desc: o.desc.trim(), siteId: siteId, stageId: stageId, remind: remind, remindCustom: remindCustom, remindTo: remindTo, assignee: assignee });
      var cur = S.getTask(S.load(), this.tid);
      if (noDate) { if (cur.currDate) S.updateTask(this.tid, { currDate: '' }); }
      else if (cur.currDate !== dv) { S.changeDate(this.tid, dv); }
    } else {
      var t = S.addTask({
        siteId: siteId, stageId: stageId, name: o.name.trim(), desc: o.desc.trim(),
        date: dv, proc: siteId !== 'other' && o.proc,
        remind: remind, remindCustom: remindCustom, remindTo: remindTo, assignee: assignee
      });
      // 从日记"明日事项"转来的:任务真建成了才回写 ✓
      if (this.tmDiary && this.tmIdx >= 0) S.markTomorrowConverted(this.tmDiary, this.tmIdx, t.id);
    }
    wx.navigateBack();
  },
  del: function () {
    var that = this;
    wx.showModal({
      title: '删除任务', content: '确定删除?',
      success: function (r) { if (r.confirm) { S.removeTask(that.tid); wx.navigateBack() } }
    });
  }
});
