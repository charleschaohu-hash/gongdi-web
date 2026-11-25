// 数据层 · 网页版。从微信小程序 utils/store.js 移植而来。
// 规则与小程序版一致：工序改期自动记延迟并顺延同阶段后续工序、双轨日期（planDate/currDate/doneDate）、
// 日期可空=待定、挂起任务记 waitSince、工序全完成自动推进阶段、日记自动带入当天系统记录。
// 去掉的部分：云函数同步、微信订阅消息、成员/邀请码/指派。数据只存在当前浏览器的 localStorage 里。
(function (global) {
  var KEY = 'gd_web_v1';
  var WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  var CACHE = null;
  var FILTER = [];   // 今日/日历共用的工地筛选（siteId 数组，空=全部）

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
  function readStorage() {
    try { var raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null } catch (e) { return null }
  }
  function load() {
    if (!CACHE) { CACHE = readStorage() || empty(); if (!CACHE.sites) CACHE = empty(); }
    return CACHE;
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(CACHE)) } catch (e) { /* 隐私模式等 */ } }
  function replaceAll(data) { CACHE = data; persist(); }
  function resetAll() { CACHE = empty(); persist(); }
  function hasData() { return !!readStorage() }
  function getFilter() { return FILTER.slice() }
  function setFilter(arr) { FILTER = (arr || []).slice() }

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
  function delayCount(id) { var d = load(); return d.delays.filter(function (x) { return x.taskId === id }).length }

  // ---- 变更操作 ----
  function createSite(o) {
    var d = load(); var id = genId('s');
    var s = { id: id, name: o.name, addr: o.addr || '', start: o.start, status: 'active', tag: '在建', note: '', noteDate: '' };
    d.sites.push(s);
    o.stages.forEach(function (nm, i) {
      d.stages.push({ id: genId('g'), siteId: id, name: nm, order: i, parent: null, status: i === 0 ? 'current' : 'pending', actualStart: i === 0 ? o.start : null, actualEnd: null });
    });
    persist(); return id;
  }
  function updateSiteNote(siteId, note) {
    var d = load(); var s = getSite(d, siteId);
    if (s) { s.note = note; s.noteDate = today(); persist(); }
  }
  function setSiteTag(siteId, tag) { var d = load(); var s = getSite(d, siteId); if (s) { s.tag = tag; persist(); } }
  function addTask(o) {
    var d = load();
    var t = {
      id: genId('t'), siteId: o.siteId, stageId: o.stageId || null, name: o.name,
      desc: o.desc || '', proc: !!o.proc, st: 'todo',
      planDate: o.date || '', currDate: o.date || '', doneDate: null, waitSince: null
    };
    d.tasks.push(t); persist(); return t;
  }
  function updateTask(id, o) {
    var d = load(); var t = getTask(d, id);
    if (t) { Object.assign(t, o); persist(); }
  }
  function removeTask(id) {
    var d = load();
    d.tasks = d.tasks.filter(function (t) { return t.id !== id });
    d.delays = d.delays.filter(function (x) { return x.taskId !== id });
    persist();
  }
  // 完成：工序任务全完成时自动推进阶段。返回 { t, adv:{stage,next}|null }
  function completeTask(id) {
    var d = load(); var t = getTask(d, id); if (!t) return null;
    t.st = 'done'; t.doneDate = today();
    var adv = null;
    if (t.stageId) {
      var g = getStage(d, t.stageId);
      if (g && g.status !== 'done') {
        var ts = d.tasks.filter(function (x) { return x.stageId === g.id });
        if (ts.some(function (x) { return x.proc }) && ts.every(function (x) { return x.st === 'done' })) {
          adv = stageDone(d, g);
        }
      }
    }
    persist(); return { t: t, adv: adv };
  }
  function reopenTask(id) { var d = load(); var t = getTask(d, id); t.st = 'todo'; t.doneDate = null; persist(); }
  function waitTask(id, on) { var d = load(); var t = getTask(d, id); t.st = on ? 'wait' : 'todo'; t.waitSince = on ? today() : null; persist(); }
  // 改期：工序任务往后改 → 记延迟流水 + 同阶段后续未完成工序顺延同样天数；往前改视为提前，不记延迟
  function changeDate(id, nv, reason) {
    var d = load(); var t = getTask(d, id); var old = t.currDate;
    if (!old) { t.currDate = nv; if (!t.planDate) t.planDate = nv; persist(); return 0; }
    var n = diff(nv, old); t.currDate = nv;
    if (t.proc && n > 0) {
      d.tasks.forEach(function (x) {
        if (x.id !== t.id && x.proc && x.siteId === t.siteId && x.stageId === t.stageId && x.st !== 'done' && x.currDate && x.currDate >= old) {
          x.currDate = addDays(x.currDate, n);
        }
      });
      d.delays.push({ id: genId('dl'), taskId: t.id, siteId: t.siteId, stageId: t.stageId, days: n, reason: reason || '', date: today() });
    }
    persist(); return t.proc && n > 0 ? n : 0;
  }
  function mergeStage(id, parentId) { var d = load(); var g = getStage(d, id); g.parent = parentId; persist(); }
  function unmergeStage(id) { var d = load(); var g = getStage(d, id); g.parent = null; persist(); }
  // 阶段状态：done 时若同工地没有进行中的独立阶段，自动把下一个未开始的设为进行中
  function stageDone(d, g) {
    g.status = 'done'; g.actualEnd = today();
    var next = null;
    if (!g.parent) {
      var tops = d.stages.filter(function (x) { return x.siteId === g.siteId && !x.parent })
        .sort(function (a, b) { return a.order - b.order });
      if (!tops.some(function (x) { return x.status === 'current' })) {
        next = tops.filter(function (x) { return x.order > g.order && x.status === 'pending' })[0] || null;
        if (next) { next.status = 'current'; next.actualStart = today(); }
      }
    }
    return { stage: g, next: next };
  }
  function setStageStatus(id, status) {
    var d = load(); var g = getStage(d, id); if (!g) return null;
    var adv = null;
    if (status === 'done') adv = stageDone(d, g);
    else {
      g.status = status;
      if (status === 'current') { if (!g.actualStart) g.actualStart = today(); g.actualEnd = null; }
      if (status === 'pending') { g.actualStart = null; g.actualEnd = null; }
    }
    persist(); return adv;
  }

  // ---- 日记 ----
  function getDiary(date) { var d = load(); return d.diaries.filter(function (x) { return x.date === date })[0] || null }
  function getDiaryById(id) { var d = load(); return d.diaries.filter(function (x) { return x.id === id })[0] || null }
  function saveDiary(entry) {
    var d = load();
    entry.id = entry.id || ('d' + entry.date);
    var i = -1;
    d.diaries.forEach(function (x, idx) { if (x.id === entry.id) i = idx });
    if (i >= 0) d.diaries[i] = entry; else d.diaries.push(entry);
    persist(); return entry;
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
      if (t.st === 'done' && t.doneDate === date) out.push('✓ ' + t.name + ' · 完成');
    });
    d.delays.forEach(function (x) {
      if (x.siteId !== siteId || x.date !== date) return;
      var t = getTask(d, x.taskId);
      out.push('⏱ ' + (t ? t.name : '任务') + ' · 记延迟' + x.days + '天' + (x.reason ? ':' + x.reason : ''));
    });
    return out;
  }

  global.S = {
    load: load, persist: persist, resetAll: resetAll, replaceAll: replaceAll, hasData: hasData,
    getFilter: getFilter, setFilter: setFilter, delayCount: delayCount,
    today: today, iso: iso, isoOf: isoOf, fmt: fmt, fmtShort: fmtShort, addDays: addDays, diff: diff, genId: genId,
    getSite: getSite, getStage: getStage, getTask: getTask, siteDelay: siteDelay, taskMeta: taskMeta,
    createSite: createSite, updateSiteNote: updateSiteNote, setSiteTag: setSiteTag,
    addTask: addTask, updateTask: updateTask, removeTask: removeTask, completeTask: completeTask,
    reopenTask: reopenTask, waitTask: waitTask, changeDate: changeDate,
    mergeStage: mergeStage, unmergeStage: unmergeStage, setStageStatus: setStageStatus,
    getDiary: getDiary, getDiaryById: getDiaryById, saveDiary: saveDiary,
    markTomorrowConverted: markTomorrowConverted, sysLines: sysLines
  };
})(window);
