// 数据层 · 云开发版:内存缓存 + 本地镜像 + 云端同步。页面接口与本地版兼容。
// v4.5:提醒/动态推送字段、额度申请、热启动静默刷新、离线队列不再死循环、阶段状态推进、日记按 id
// v4.6:角色(isAdmin)、任务指派(assignee)、员工自建任务归自己、邀请码带角色、成员管理
var MIRROR = 'gd_cloud_cache_v1';
var PENDKEY = 'gd_pending_v1';
var OLDKEY = 'gd_data_v1';
var WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
var CACHE = null, ME = null, MEMBERS = [], NOTES = [], FLUSHING = false, LASTERR = '';
var BOOTED = 'gd_booted_v1';
var BOOTSTATE = 'pending', BOUNCED = false, LASTBOOT = 0, BOOTING = false;
var TPL = 'YOUR_SUBSCRIBE_TEMPLATE_ID';
var REFRESH_GAP = 5 * 60 * 1000;   // 热启动超过5分钟静默拉一次云端
var QUOTA_TS = 0, RETRY = null;
var REMIND = [
  { v: 'none', l: '不提醒' },
  { v: 'morning', l: '当天早上7点' },
  { v: 'd1', l: '提前1天(前一天晚8点)' },
  { v: 'd2', l: '提前2天(晚8点)' },
  { v: 'd3', l: '提前3天(晚8点)' },
  { v: 'w1', l: '提前1周(晚8点)' },
  { v: 'custom', l: '自定义时间' }
];
function getLastError() { return LASTERR }
var FILTER = [];   // 今日/日历共用的工地筛选(siteId 数组,空=全部),小程序重启后清空
function getFilter() { return FILTER.slice() }
function setFilter(arr) { FILTER = (arr || []).slice() }
function bounce() {
  if (BOUNCED) return; BOUNCED = true;
  var reason = BOOTSTATE.replace('fail-', '');
  setTimeout(function () {
    wx.reLaunch({ url: '/pages/noaccess/noaccess?reason=' + reason });
  }, 50);
}

function pad(n) { return n < 10 ? '0' + n : '' + n }
function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) }
function isoOf(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d) }
function parse(s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]) }
function today() { return iso(new Date()) }
function fmt(s) { if (!s) return ''; var d = parse(s); return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WD[d.getDay()] }
function fmtShort(s) { if (!s) return ''; var d = parse(s); return (d.getMonth() + 1) + '月' + d.getDate() + '日' }
function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d) }
function diff(a, b) { if (!a || !b) return 0; return Math.round((parse(a) - parse(b)) / 86400000) }
function genId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

function empty() {
  return {
    sites: [], stages: [], tasks: [], delays: [], diaries: [],
    template: ['图纸与设计', '拆除', '地基', '结构', '外墙', '水电', '内装', '验收与CO'],
    quick: ['联系材料送货', '约检查员', '安排工人进场', '催报价'], seq: 1
  };
}
function load() {
  // 岗哨:启动校验已明确失败(无权限/停用/首启断网)时,任何内部页面都会被弹回锁页,绕不过去
  if (BOOTSTATE.indexOf('fail') === 0) bounce();
  if (!CACHE) { CACHE = wx.getStorageSync(MIRROR) || empty(); if (!CACHE.sites) CACHE = empty(); }
  return CACHE;
}
function persist() { wx.setStorageSync(MIRROR, CACHE) }
function me() { return ME }
function isAdmin() { return !!(ME && ME.role === 'admin') }
function myOpen() { return ME ? ME.openid : 'local' }
function membersList() { return MEMBERS }
function memberName(openid) {
  if (!openid) return '';
  if (ME && openid === ME.openid) return ME.name;
  var m = MEMBERS.filter(function (x) { return x.openid === openid })[0];
  return m ? m.name : '同事';
}
function notes() { return NOTES }

// ---- 云端通信 ----
function callApi(payload, cb) {
  wx.cloud.callFunction({ name: 'api', data: payload })
    .then(function (r) { cb && cb(r.result || { ok: false, reason: 'empty' }) })
    .catch(function (e) {
      LASTERR = (e && (e.errMsg || e.message)) ? (e.errMsg || e.message) : JSON.stringify(e);
      cb && cb({ ok: false, reason: 'network', err: e });
    });
}
function queueSave(items) {
  var q = wx.getStorageSync(PENDKEY) || [];
  q = q.concat(items); wx.setStorageSync(PENDKEY, q);
  flush();
}
function queueRemove(col, id) { queueSave([{ __rm: true, col: col, id: id }]) }
// 失败即停,不再原地重试(等下次 App.onShow / 下次保存再触发),避免断网时死循环
function flush(cb) {
  if (FLUSHING) return cb && cb();
  var q = wx.getStorageSync(PENDKEY) || [];
  if (!q.length) return cb && cb();
  FLUSHING = true;
  var rms = q.filter(function (x) { return x.__rm });
  var saves = q.filter(function (x) { return !x.__rm }).slice(0, 50);
  var after = function (ok) {
    FLUSHING = false;
    if (!ok) {
      if (!RETRY) RETRY = setTimeout(function () { RETRY = null; flush() }, 30000);
      return cb && cb();
    }
    var left = (wx.getStorageSync(PENDKEY) || []);
    if (left.length) flush(cb); else cb && cb();
  };
  if (rms.length) {
    var r = rms[0];
    callApi({ action: 'remove', col: r.col, id: r.id }, function (res) {
      if (res.ok) {
        var q2 = wx.getStorageSync(PENDKEY) || [];
        var i = q2.findIndex(function (x) { return x.__rm && x.id === r.id });
        if (i >= 0) q2.splice(i, 1);
        wx.setStorageSync(PENDKEY, q2);
      }
      after(!!res.ok);
    });
  } else {
    callApi({ action: 'saveMany', items: saves }, function (res) {
      if (res.ok) {
        var q2 = wx.getStorageSync(PENDKEY) || [];
        q2 = q2.slice(saves.length); wx.setStorageSync(PENDKEY, q2);
      }
      after(!!res.ok);
    });
  }
}
// 拉完云端后,把本机还没传上去的改动叠回去,避免刷新后"自己刚改的东西不见了"
function applyPending(c) {
  var q = wx.getStorageSync(PENDKEY) || [];
  q.forEach(function (it) {
    if (it.__rm) {
      if (c[it.col]) c[it.col] = c[it.col].filter(function (x) { return x.id !== it.id });
      return;
    }
    if (it.col === 'settings') {
      if (it.doc._id === 'template' && it.doc.names) c.template = it.doc.names;
      if (it.doc._id === 'quick' && it.doc.items) c.quick = it.doc.items;
      return;
    }
    if (!c[it.col]) return;
    var doc = it.doc; var id = doc.id || doc._id;
    var i = -1; c[it.col].forEach(function (x, idx) { if (x.id === id) i = idx });
    if (i >= 0) c[it.col][i] = doc; else c[it.col].push(doc);
  });
}

// ---- 启动:身份校验 + 全量拉取 ----
function boot(cb) {
  if (BOOTING) return cb && cb({ ok: false, reason: 'busy' });
  BOOTING = true;
  callApi({ action: 'boot' }, function (r) {
    BOOTING = false;
    if (!r.ok) {
      if (r.reason === 'network') {
        if (wx.getStorageSync(BOOTED)) { BOOTSTATE = 'ok'; cb && cb({ ok: true, offline: true }); return }
        BOOTSTATE = 'fail-offline'; cb && cb({ ok: false, reason: 'offline' }); return;
      }
      BOOTSTATE = 'fail-' + r.reason; cb && cb({ ok: false, reason: r.reason }); return;
    }
    ME = r.me; MEMBERS = r.members || []; NOTES = r.notes || [];
    var d = r.data || {};
    var c = empty();
    c.sites = d.sites || []; c.stages = d.stages || []; c.tasks = d.tasks || [];
    c.delays = d.delays || []; c.diaries = d.diaries || [];
    (d.settings || []).forEach(function (s) {
      if (s._id === 'template' && s.names) c.template = s.names;
      if (s._id === 'quick' && s.items) c.quick = s.items;
    });
    ['sites', 'stages', 'tasks', 'delays', 'diaries'].forEach(function (k) {
      c[k].forEach(function (x) { if (!x.id) x.id = x._id });
    });
    applyPending(c);
    CACHE = c; persist();
    wx.setStorageSync(BOOTED, 1);
    BOOTSTATE = 'ok'; BOUNCED = false; LASTBOOT = Date.now();
    flush();
    cb && cb({ ok: true });
  });
}
function refresh(cb) { boot(cb) }
// 热启动:距上次同步超过 5 分钟就静默拉一次,拉完刷新当前页
function maybeRefresh() {
  if (BOOTSTATE !== 'ok' || !LASTBOOT) return;
  if (Date.now() - LASTBOOT < REFRESH_GAP) return;
  boot(function (r) {
    if (!r.ok || r.offline) return;
    var pages = getCurrentPages(); var pg = pages[pages.length - 1];
    if (pg && pg.build) pg.build(); else if (pg && pg.onShow) pg.onShow();
  });
}
function redeem(code, name, cb) { callApi({ action: 'redeem', code: code, name: name || '' }, cb) }
function renameMe(name, cb) {
  callApi({ action: 'rename', name: name }, function (r) {
    if (r.ok && ME) {
      ME.name = name;
      MEMBERS.forEach(function (m) { if (m.openid === ME.openid) m.name = name });
    }
    cb && cb(r);
  });
}
function makeInvite(role, cb) {
  if (typeof role === 'function') { cb = role; role = 'member' }
  callApi({ action: 'invite', role: role }, cb);
}
function setMember(openid, patch, cb) {
  callApi(Object.assign({ action: 'setMember', openid: openid }, patch), function (r) {
    if (r.ok) MEMBERS.forEach(function (m) { if (m.openid === openid) Object.assign(m, patch) });
    cb && cb(r);
  });
}
function setPrefs(scope, mode, cb) {
  callApi({ action: 'setPrefs', scope: scope, mode: mode }, function (r) {
    if (r.ok && ME) ME.prefs = { scope: scope, mode: mode };
    cb && cb(r);
  });
}
function clearNotes(cb) { NOTES = []; callApi({ action: 'clearNotes' }, cb) }
function cronStatus(cb) { callApi({ action: 'cronStatus' }, cb) }

// ---- 订阅额度:在用户点按钮时静默申请一次性订阅;拿到就上报 +1 ----
// 必须在 tap 事件同步链里调用。首次会弹授权框,勾"总是保持以上选择"后不再弹。
function askQuota(cb, force) {
  var now = Date.now();
  if (!force && now - QUOTA_TS < 10000) return cb && cb();
  if (!wx.requestSubscribeMessage || !ME) return cb && cb();
  QUOTA_TS = now;
  var done = false, reporting = false;
  var fin = function () { if (!done) { done = true; cb && cb() } };
  try {
    wx.requestSubscribeMessage({
      tmplIds: [TPL],
      success: function (res) {
        if (res && res[TPL] === 'accept') {
          reporting = true;
          callApi({ action: 'subscribe' }, function (r) { if (r.ok && ME) ME.quota = r.quota; fin() });
        }
      },
      complete: function () { if (!reporting) fin() }
    });
  } catch (e) { fin() }
  setTimeout(fin, 60000);
}

// ---- 查询辅助 ----
function getSite(d, id) { return d.sites.filter(function (s) { return s.id === id })[0] }
function getStage(d, id) { return d.stages.filter(function (s) { return s.id === id })[0] }
function getTask(d, id) { return d.tasks.filter(function (t) { return t.id === id })[0] }
function siteDelay(d, siteId) { return d.delays.filter(function (x) { return x.siteId === siteId }).reduce(function (a, b) { return a + b.days }, 0) }
function taskMeta(d, t) {
  if (t.siteId === 'other') return '其他事项';
  var s = getSite(d, t.siteId); var g = t.stageId ? getStage(d, t.stageId) : null;
  return (s ? s.name : '') + (g ? ' · ' + g.name : '');
}
function remindLabel(v) { var o = REMIND.filter(function (x) { return x.v === (v || 'none') })[0]; return o ? o.l : '不提醒' }

// ---- 提醒时间计算(手机本地时间 = 纽约时间) ----
function calcRemindAt(t) {
  var r = t.remind || 'none';
  if (r === 'none') return null;
  if (r === 'custom') {
    if (!t.remindCustom) return null;
    var a = t.remindCustom.split(' '); var d = parse(a[0]); var hm = (a[1] || '08:00').split(':');
    d.setHours(+hm[0], +hm[1], 0, 0); return d.getTime();
  }
  if (!t.currDate) return null;
  var dd = parse(t.currDate);
  if (r === 'morning') { dd.setHours(7, 0, 0, 0); return dd.getTime() }
  var back = { d1: 1, d2: 2, d3: 3, w1: 7 }[r]; if (!back) return null;
  dd.setDate(dd.getDate() - back); dd.setHours(20, 0, 0, 0); return dd.getTime();
}
function applyRemind(t) {
  var at = calcRemindAt(t);
  t.remindAt = at;
  // 过期超过12小时的提醒不补发(如日期往前挪);12小时内的照发(晚到总比没有好)
  t.remindSent = at ? (at < Date.now() - 12 * 3600 * 1000) : false;
}

// ---- 动态流水(完成/延迟)→ 云函数按各人偏好推送 ----
function feedItem(type, t, extra) {
  var d = load(); var s = t.siteId === 'other' ? null : getSite(d, t.siteId);
  var ev = Object.assign({
    id: genId('f'), type: type, taskId: t.id, taskName: t.name, siteId: t.siteId,
    siteName: s ? s.name : '其他事项', actor: myOpen(), actorName: ME ? ME.name : '',
    creator: t.createdBy || t.updatedBy || '', date: today(), ts: Date.now()
  }, extra || {});
  return { col: 'feed', doc: ev };
}

// ---- 变更操作:先改缓存,再排队上云 ----
function svSite(s) { queueSave([{ col: 'sites', doc: s }]) }
function svStage(g) { queueSave([{ col: 'stages', doc: g }]) }
function svTask(t) { queueSave([{ col: 'tasks', doc: t }]) }

function createSite(o) {
  var d = load(); var id = genId('s');
  var s = { id: id, name: o.name, addr: o.addr || '', start: o.start, status: 'active', tag: '在建', note: '', noteDate: '', createdBy: myOpen() };
  d.sites.push(s); var items = [{ col: 'sites', doc: s }];
  o.stages.forEach(function (nm, i) {
    var g = { id: genId('g'), siteId: id, name: nm, order: i, parent: null, status: i === 0 ? 'current' : 'pending', actualStart: i === 0 ? o.start : null, actualEnd: null };
    d.stages.push(g); items.push({ col: 'stages', doc: g });
  });
  persist(); queueSave(items); return id;
}
function updateSiteNote(siteId, note) {
  var d = load(); var s = getSite(d, siteId);
  if (s) { s.note = note; s.noteDate = today(); persist(); svSite(s); }
}
function addTask(o) {
  var d = load();
  var t = {
    id: genId('t'), siteId: o.siteId, stageId: o.stageId || null, name: o.name,
    desc: o.desc || '', proc: !!o.proc, st: 'todo',
    planDate: o.date || '', currDate: o.date || '', doneDate: null, waitSince: null,
    assignee: isAdmin() ? (o.assignee || '') : myOpen(), createdBy: myOpen(),
    remind: o.remind || 'none', remindCustom: o.remindCustom || '', remindTo: o.remindTo || []
  };
  applyRemind(t);
  d.tasks.push(t); persist(); svTask(t); return t;
}
function updateTask(id, o) {
  var d = load(); var t = getTask(d, id);
  if (t) { Object.assign(t, o); applyRemind(t); persist(); svTask(t); }
}
function removeTask(id) {
  var d = load();
  d.tasks = d.tasks.filter(function (t) { return t.id !== id });
  d.delays = d.delays.filter(function (x) { return x.taskId !== id });
  persist(); queueRemove('tasks', id);
}
function delayCount(id) { var d = load(); return d.delays.filter(function (x) { return x.taskId === id }).length }
// 完成:写动态;工序任务全完成时自动推进阶段。返回 { t, adv:{stage,next}|null }
function completeTask(id) {
  var d = load(); var t = getTask(d, id); if (!t) return null;
  t.st = 'done'; t.doneDate = today(); t.doneBy = myOpen();
  var items = [{ col: 'tasks', doc: t }, feedItem('done', t)];
  var adv = null;
  if (t.stageId && isAdmin()) {
    var g = getStage(d, t.stageId);
    if (g && g.status !== 'done') {
      var ts = d.tasks.filter(function (x) { return x.stageId === g.id });
      if (ts.some(function (x) { return x.proc }) && ts.every(function (x) { return x.st === 'done' })) {
        adv = stageDone(d, g, items);
      }
    }
  }
  persist(); queueSave(items); return { t: t, adv: adv };
}
function reopenTask(id) { var d = load(); var t = getTask(d, id); t.st = 'todo'; t.doneDate = null; t.doneBy = null; persist(); svTask(t); }
function waitTask(id, on) { var d = load(); var t = getTask(d, id); t.st = on ? 'wait' : 'todo'; t.waitSince = on ? today() : null; persist(); svTask(t); }
function changeDate(id, nv, reason) {
  var d = load(); var t = getTask(d, id); var old = t.currDate;
  if (!old) { t.currDate = nv; if (!t.planDate) t.planDate = nv; applyRemind(t); persist(); svTask(t); return 0; }
  var n = diff(nv, old); t.currDate = nv; applyRemind(t);
  var items = [{ col: 'tasks', doc: t }];
  if (t.proc && n > 0) {
    d.tasks.forEach(function (x) {
      if (x.id !== t.id && x.proc && x.siteId === t.siteId && x.stageId === t.stageId && x.st !== 'done' && x.currDate && x.currDate >= old) {
        x.currDate = addDays(x.currDate, n); applyRemind(x); items.push({ col: 'tasks', doc: x });
      }
    });
    var rec = { id: genId('dl'), taskId: t.id, siteId: t.siteId, stageId: t.stageId, days: n, reason: reason || '', date: today() };
    d.delays.push(rec); items.push({ col: 'delays', doc: rec });
    items.push(feedItem('delay', t, { days: n, reason: reason || '' }));
  }
  persist(); queueSave(items); return t.proc && n > 0 ? n : 0;
}
function mergeStage(id, parentId) { var d = load(); var g = getStage(d, id); g.parent = parentId; persist(); svStage(g); }
function unmergeStage(id) { var d = load(); var g = getStage(d, id); g.parent = null; persist(); svStage(g); }
// 阶段状态:done 时若同工地没有进行中的独立阶段,自动把下一个未开始的设为进行中
function stageDone(d, g, items) {
  g.status = 'done'; g.actualEnd = today();
  items.push({ col: 'stages', doc: g });
  var next = null;
  if (!g.parent) {
    var tops = d.stages.filter(function (x) { return x.siteId === g.siteId && !x.parent })
      .sort(function (a, b) { return a.order - b.order });
    if (!tops.some(function (x) { return x.status === 'current' })) {
      next = tops.filter(function (x) { return x.order > g.order && x.status === 'pending' })[0] || null;
      if (next) { next.status = 'current'; next.actualStart = today(); items.push({ col: 'stages', doc: next }); }
    }
  }
  return { stage: g, next: next };
}
function setStageStatus(id, status) {
  var d = load(); var g = getStage(d, id); if (!g) return null;
  var items = []; var adv = null;
  if (status === 'done') adv = stageDone(d, g, items);
  else {
    g.status = status;
    if (status === 'current') { if (!g.actualStart) g.actualStart = today(); g.actualEnd = null; }
    if (status === 'pending') { g.actualStart = null; g.actualEnd = null; }
    items.push({ col: 'stages', doc: g });
  }
  persist(); queueSave(items); return adv;
}
function saveTemplate() { var d = load(); queueSave([{ col: 'settings', doc: { id: 'template', _id: 'template', names: d.template } }]) }
function saveQuick() { var d = load(); queueSave([{ col: 'settings', doc: { id: 'quick', _id: 'quick', items: d.quick } }]) }

// ---- 日记(带作者;按 id 打开,他人的只读) ----
function getDiary(date) {
  var d = load(); var mo = myOpen();
  return d.diaries.filter(function (x) { return x.date === date && (!x.author || x.author === mo) })[0] || null;
}
function getDiaryById(id) { var d = load(); return d.diaries.filter(function (x) { return x.id === id })[0] || null }
function saveDiary(entry) {
  var d = load(); var mo = myOpen();
  if (!entry.author) entry.author = mo;
  entry.id = entry.id || ('d' + entry.date + '-' + String(entry.author).slice(-6));
  var i = -1;
  d.diaries.forEach(function (x, idx) { if (x.id === entry.id) i = idx });
  if (i >= 0) d.diaries[i] = entry; else d.diaries.push(entry);
  persist(); queueSave([{ col: 'diaries', doc: entry }]);
  return entry;
}
// 明日事项真正建成任务后才回写 ✓
function markTomorrowConverted(diaryId, idx, taskId) {
  var e = getDiaryById(diaryId); if (!e || !e.tomorrow || !e.tomorrow[idx]) return;
  e.tomorrow[idx] = Object.assign({}, e.tomorrow[idx], { cv: true, taskId: taskId });
  saveDiary(e);
}
function sysLines(d, date, siteId) {
  var out = [];
  d.tasks.forEach(function (t) {
    if (t.siteId !== siteId) return;
    if (t.st === 'done' && t.doneDate === date) out.push('✓ ' + t.name + ' · 完成' + (t.doneBy && t.doneBy !== myOpen() ? '(' + memberName(t.doneBy) + ')' : ''));
  });
  d.delays.forEach(function (x) {
    if (x.siteId !== siteId || x.date !== date) return;
    var t = getTask(d, x.taskId);
    out.push('⏱ ' + (t ? t.name : '任务') + ' · 记延迟' + x.days + '天' + (x.reason ? ':' + x.reason : ''));
  });
  return out;
}

// ---- 分页选择器 & 操作菜单 ----
function pickOne(names, cb) {
  function page(start) {
    var slice = names.slice(start, start + 5);
    var items = slice.slice();
    var hasMore = names.length > start + 5;
    if (hasMore) items.push('下一页…');
    wx.showActionSheet({
      itemList: items,
      success: function (res) {
        if (hasMore && res.tapIndex === items.length - 1) return page(start + 5);
        cb(start + res.tapIndex);
      }
    });
  }
  page(0);
}
function showTaskMenu(id, cb) {
  var d = load(); var t = getTask(d, id); if (!t) return;
  var items;
  if (t.st === 'done') { items = ['恢复为未完成'] }
  else {
    items = ['标为已完成', '修改日期'];
    items.push(t.st === 'wait' ? '恢复为待办' : '转为挂起 · 等待中');
    items.push('编辑详情');
    if (!t.proc || isAdmin()) { items.push('删除') }
  }
  wx.showActionSheet({
    itemList: items,
    success: function (res) {
      var it = items[res.tapIndex];
      if (it === '恢复为未完成') { reopenTask(id); cb && cb() }
      else if (it === '标为已完成') {
        var r = completeTask(id); cb && cb();
        var tt = r.t;
        var go = function () { if (tt.proc) followUp(tt); else wx.showToast({ title: '已完成并归档', icon: 'none' }) };
        if (r.adv) {
          var msg = '「' + r.adv.stage.name + '」阶段的工序已全部完成,已标为完成' + (r.adv.next ? ';「' + r.adv.next.name + '」进入进行中。' : '。');
          wx.showModal({ title: '阶段完成', content: msg, showCancel: false, confirmText: '好', complete: go });
        } else go();
      }
      else if (it === '修改日期') { wx.navigateTo({ url: '/pages/taskedit/taskedit?id=' + id + '&dateOnly=1' }) }
      else if (it === '转为挂起 · 等待中') { waitTask(id, true); cb && cb(); wx.showToast({ title: '已转入挂起区', icon: 'none' }) }
      else if (it === '恢复为待办') { waitTask(id, false); cb && cb() }
      else if (it === '编辑详情') { wx.navigateTo({ url: '/pages/taskedit/taskedit?id=' + id }) }
      else if (it === '删除') {
        var n = delayCount(id);
        var msg = '删除「' + t.name + '」？';
        if (t.proc) msg += n ? ('\n这是工序任务,将同时删除它的 ' + n + ' 条延迟记录。') : '\n这是工序任务。';
        wx.showModal({
          title: '删除任务', content: msg, confirmColor: '#A32D2D',
          success: function (r) { if (r.confirm) { removeTask(id); cb && cb() } }
        });
      }
    }
  });
}
function followUp(t) {
  var d = load(); var items = d.quick.concat(['自定义…']);
  pickOne(items, function (idx) {
    var it = items[idx];
    var url = '/pages/taskedit/taskedit?siteId=' + t.siteId + '&stageId=' + (t.stageId || '') + '&date=' + addDays(today(), 1);
    if (it !== '自定义…') url += '&name=' + encodeURIComponent(it);
    wx.navigateTo({ url: url });
  });
}
function showStageMenu(id, cb) {
  var d = load(); var g = getStage(d, id); if (!g) return;
  var all = [{ s: 'done', l: '标为已完成' }, { s: 'current', l: '标为进行中' }, { s: 'pending', l: '标为未开始' }];
  var opts = all.filter(function (o) { return o.s !== g.status });
  wx.showActionSheet({
    itemList: opts.map(function (o) { return o.l }),
    success: function (res) {
      var o = opts[res.tapIndex]; var adv = setStageStatus(id, o.s); cb && cb();
      if (o.s === 'done' && adv && adv.next) wx.showToast({ title: '「' + adv.next.name + '」进入进行中', icon: 'none' });
    }
  });
}

// ---- 数据导入 / 迁移(全部推上云) ----
function pushAll(c) {
  var items = [];
  c.sites.forEach(function (x) { items.push({ col: 'sites', doc: x }) });
  c.stages.forEach(function (x) { items.push({ col: 'stages', doc: x }) });
  c.tasks.forEach(function (x) { items.push({ col: 'tasks', doc: x }) });
  c.delays.forEach(function (x) { if (!x.id) x.id = genId('dl'); items.push({ col: 'delays', doc: x }) });
  c.diaries.forEach(function (x) {
    x.author = x.author || myOpen();
    if (!x.id) x.id = 'd' + x.date + '-' + String(x.author).slice(-6);
    items.push({ col: 'diaries', doc: x });
  });
  items.push({ col: 'settings', doc: { id: 'template', _id: 'template', names: c.template } });
  items.push({ col: 'settings', doc: { id: 'quick', _id: 'quick', items: c.quick } });
  queueSave(items);
}
function importReal() {
  // 公开仓库里去掉了 realdata.js（公司真实工地数据）。需要种子数据时自行提供同结构的 build(today) 函数。
  wx.showToast({ title: '此版本不含真实数据文件', icon: 'none' });
}
function migrateOld(cb) {
  var old = wx.getStorageSync(OLDKEY);
  if (!old || !old.sites || !old.sites.length) { cb && cb(false); return }
  var d = load();
  ['sites', 'stages', 'tasks', 'delays', 'diaries'].forEach(function (k) {
    (old[k] || []).forEach(function (x) {
      if (!d[k].some(function (y) { return y.id === x.id })) d[k].push(x);
    });
  });
  if (old.template) d.template = old.template;
  if (old.quick) d.quick = old.quick;
  persist(); pushAll(d); cb && cb(true);
}
function resetAll() { CACHE = empty(); persist(); }

module.exports = {
  REMIND: REMIND, remindLabel: remindLabel, TPL: TPL,
  getLastError: getLastError, getFilter: getFilter, setFilter: setFilter, delayCount: delayCount,
  load: load, persist: persist, resetAll: resetAll, boot: boot, refresh: refresh, flush: flush, maybeRefresh: maybeRefresh,
  redeem: redeem, renameMe: renameMe, makeInvite: makeInvite, setMember: setMember, me: me, isAdmin: isAdmin, myOpen: myOpen, membersList: membersList, memberName: memberName,
  setPrefs: setPrefs, askQuota: askQuota, notes: notes, clearNotes: clearNotes, cronStatus: cronStatus,
  today: today, iso: iso, isoOf: isoOf, fmt: fmt, fmtShort: fmtShort, addDays: addDays, diff: diff,
  getSite: getSite, getStage: getStage, getTask: getTask, siteDelay: siteDelay, taskMeta: taskMeta,
  createSite: createSite, updateSiteNote: updateSiteNote, addTask: addTask, updateTask: updateTask,
  removeTask: removeTask, completeTask: completeTask, reopenTask: reopenTask, waitTask: waitTask,
  changeDate: changeDate, mergeStage: mergeStage, unmergeStage: unmergeStage, setStageStatus: setStageStatus, showStageMenu: showStageMenu,
  saveTemplate: saveTemplate, saveQuick: saveQuick,
  getDiary: getDiary, getDiaryById: getDiaryById, saveDiary: saveDiary, markTomorrowConverted: markTomorrowConverted, sysLines: sysLines,
  pickOne: pickOne, showTaskMenu: showTaskMenu, importReal: importReal, migrateOld: migrateOld
};
