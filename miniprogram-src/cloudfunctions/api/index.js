// 唯一后端入口:所有读写都过这里,逐次校验 openid 白名单
// v4.5:订阅消息推送(到期提醒 + 任务动态即时/汇总)、定时触发器、额度池、未发兜底;权限收紧
// v4.6:角色分级(admin/member)、任务指派、员工只见自己任务、指派即时推送、成员管理
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const TPL = 'YOUR_SUBSCRIBE_TEMPLATE_ID';   // 订阅消息模板:任务名称/申请项目/日期/备注
const ALL_COLS = ['members', 'invites', 'sites', 'stages', 'tasks', 'delays', 'diaries', 'settings', 'feed', 'notes'];
const DATA_COLS = ['sites', 'stages', 'tasks', 'delays', 'diaries', 'settings', 'feed']; // 前端可直接写的集合
const MEMBER_COLS = ['tasks', 'delays', 'diaries', 'feed'];   // 员工角色只能写这些,且逐条校验归属
let COLS_READY = false;

// ---------- 通用 ----------
async function ensureCols() {
  if (COLS_READY) return;
  for (const c of ALL_COLS) { try { await db.createCollection(c) } catch (e) { } }
  COLS_READY = true;
}
async function getMember(openid) {
  try { const r = await db.collection('members').doc(openid).get(); return r.data } catch (e) { return null }
}
async function pullCol(c, where) {
  const out = []; let skip = 0;
  while (true) {
    let q = db.collection(c); if (where) q = q.where(where);
    const r = await q.skip(skip).limit(100).get();
    out.push.apply(out, r.data);
    if (r.data.length < 100) break; skip += 100;
    if (skip > 5000) break;
  }
  return out;
}
async function docExists(col, id) {
  try { const r = await db.collection(col).doc(id).get(); return !!r.data } catch (e) { return false }
}
function pad(n) { return n < 10 ? '0' + n : '' + n }

// ---------- 纽约时间(手工算夏令时:3月第二个周日 02:00 起 → 11月第一个周日 02:00 止) ----------
function nthSunday(y, m, n) { // m: 0-based
  const d = new Date(Date.UTC(y, m, 1));
  const first = (7 - d.getUTCDay()) % 7 + 1;
  return first + (n - 1) * 7;
}
function nyOffset(ms) {
  const d = new Date(ms); const y = d.getUTCFullYear();
  const start = Date.UTC(y, 2, nthSunday(y, 2, 2), 7);   // EST 02:00 = UTC 07:00
  const end = Date.UTC(y, 10, nthSunday(y, 10, 1), 6);   // EDT 02:00 = UTC 06:00
  return (ms >= start && ms < end) ? -4 : -5;
}
function nyParts(ms) {
  const off = nyOffset(ms); const d = new Date(ms + off * 3600 * 1000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() };
}
function nyIso(ms) { const p = nyParts(ms); return p.y + '-' + pad(p.m) + '-' + pad(p.d) }
function fmtTime(ms) { const p = nyParts(ms); return p.y + '年' + p.m + '月' + p.d + '日 ' + pad(p.h) + ':' + pad(p.mi) }
function fmtIso(s) { // '2026-09-05' → '2026年9月5日'
  if (!s) return ''; const a = s.split('-'); return +a[0] + '年' + +a[1] + '月' + +a[2] + '日';
}

// ---------- 订阅消息发送 ----------
function thing(s, def) { s = (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim(); if (!s) s = def || '—'; return s.length > 20 ? s.slice(0, 19) + '…' : s }
// 返回 true=已发, false=没发(额度不足/拒收等),失败时写 notes 兜底
async function sendMsg(to, page, task, proj, timeTxt, note, fallbackText) {
  let ok = false;
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: to, templateId: TPL, page: page || 'pages/today/today',
      data: {
        thing34: { value: thing(task, '任务') },
        thing20: { value: thing(proj, '工地') },
        time41: { value: timeTxt },
        thing13: { value: thing(note, '—') }
      }
    });
    ok = true;
  } catch (e) {
    console.log('send fail', to, e && (e.errCode || e.errMsg || e.message));
  }
  try {
    if (ok) await db.collection('members').doc(to).update({ data: { quota: _.inc(-1) } });
    else await db.collection('members').doc(to).update({ data: { quota: 0 } });
  } catch (e) { }
  if (!ok) {
    try {
      await db.collection('notes').add({ data: { to, text: fallbackText || (task + ' · ' + note), ts: Date.now(), seen: false } });
    } catch (e) { }
  }
  return ok;
}

// ---------- 任务动态:即时推送 ----------
function wantsFeed(m, ev) {
  if (!m || m.status !== 'active' || m.openid === ev.actor) return false;
  const p = m.prefs || {}; const scope = p.scope || 'mine';
  if (scope === 'none') return false;
  if (scope === 'all') return true;
  return ev.creator && ev.creator === m.openid;
}
function feedLine(ev) {
  const who = ev.actorName || '同事';
  if (ev.type === 'delay') return who + ' 记延迟' + (ev.days || 0) + '天' + (ev.reason ? ':' + ev.reason : '');
  return who + ' 已完成';
}
async function pushFeedNow(ev) {
  const members = await pullCol('members');
  for (const m of members) {
    if (!wantsFeed(m, ev)) continue;
    if ((m.prefs || {}).mode === 'digest') continue;
    await sendMsg(m.openid, 'pages/today/today', ev.taskName, ev.siteName, fmtTime(ev.ts || Date.now()),
      feedLine(ev), '动态:' + ev.taskName + ' · ' + ev.siteName + ' · ' + feedLine(ev));
  }
}

// ---------- 任务指派:即时推送给被指派人 ----------
async function pushAssign(t, actor) {
  if (!t.assignee || t.assignee === actor.openid) return;
  let proj = '其他事项';
  if (t.siteId && t.siteId !== 'other') {
    try { proj = (await db.collection('sites').doc(t.siteId).get()).data.name || '工地' } catch (e) { proj = '工地' }
  }
  const when = t.currDate ? ('计划 ' + fmtIso(t.currDate)) : '日期待定';
  await sendMsg(t.assignee, 'pages/today/today', t.name, proj, fmtTime(Date.now()),
    (actor.name || '管理员') + ' 指派给你' + (t.desc ? ':' + t.desc : ''),
    '新任务:' + t.name + ' · ' + proj + ' · ' + when + '(' + (actor.name || '管理员') + ' 指派)');
}

// ---------- 定时任务:每15分钟 ----------
async function cron() {
  const now = Date.now();
  try { await db.collection('settings').doc('cron').set({ data: { last: now } }) } catch (e) { }

  // 1) 到期提醒:remindAt <= now,未发,未完成
  const due = await pullCol('tasks', { remindAt: _.lte(now), remindSent: _.neq(true) });
  const sites = await pullCol('sites'); const siteName = {}; sites.forEach(s => siteName[s._id] = s.name);
  for (const t of due) {
    if (!t.remindAt || t.st === 'done' || t.deleted) continue;
    let to = (t.remindTo && t.remindTo.length) ? t.remindTo : [t.createdBy || t.updatedBy].filter(Boolean);
    const proj = t.siteId === 'other' ? '其他事项' : (siteName[t.siteId] || '工地');
    const when = t.currDate ? ('计划 ' + fmtIso(t.currDate)) : '日期待定';
    for (const o of to) {
      await sendMsg(o, 'pages/today/today', t.name, proj, fmtTime(t.remindAt), (t.desc || when),
        '提醒:' + t.name + ' · ' + proj + ' · ' + when);
    }
    try { await db.collection('tasks').doc(t._id).update({ data: { remindSent: true } }) } catch (e) { }
  }

  // 2) 每晚8点(纽约)汇总
  const p = nyParts(now);
  if (p.h === 20 && p.mi < 15) {
    const today = nyIso(now);
    const members = await pullCol('members');
    const feed = await pullCol('feed', { date: today });
    for (const m of members) {
      if (m.status !== 'active' || (m.prefs || {}).mode !== 'digest' || m.lastDigest === today) continue;
      const mine = feed.filter(ev => wantsFeed(m, ev));
      if (!mine.length) continue;
      const done = mine.filter(x => x.type === 'done').length, dl = mine.filter(x => x.type === 'delay').length;
      const summary = '完成' + done + '项 · 延迟' + dl + '项';
      await sendMsg(m.openid, 'pages/today/today', '今日动态汇总', '全部工地', fmtIso(today) + ' 20:00', summary,
        '今日汇总:' + summary + '(' + mine.map(ev => ev.taskName + ' ' + feedLine(ev)).join(';').slice(0, 120) + ')');
      try { await db.collection('members').doc(m.openid).update({ data: { lastDigest: today } }) } catch (e) { }
    }
  }
  return { ok: true, due: due.length };
}

// ---------- 主入口 ----------
exports.main = async (event) => {
  if (event && event.Type === 'Timer') { await ensureCols(); return cron() }

  const { OPENID } = cloud.getWXContext();
  const act = event.action;

  if (act === 'boot') {
    await ensureCols();
    let me = await getMember(OPENID);
    if (!me) {
      const cnt = await db.collection('members').count();
      if (cnt.total === 0) {
        me = { _id: OPENID, openid: OPENID, name: '管理员', role: 'admin', status: 'active', createdAt: Date.now(), quota: 0, prefs: { scope: 'mine', mode: 'now' } };
        await db.collection('members').add({ data: me });
      } else {
        return { ok: false, reason: 'not_member' };
      }
    }
    if (me.status !== 'active') return { ok: false, reason: 'disabled' };
    const data = {};
    let members;
    if (me.role === 'admin') {
      for (const c of ['sites', 'stages', 'tasks', 'delays', 'diaries', 'settings']) data[c] = await pullCol(c);
      members = (await pullCol('members')).map(m => ({ openid: m.openid, name: m.name, role: m.role, status: m.status }));
    } else {
      // 员工:只看指派给自己的任务、这些任务所在工地(含便签)、自己的延迟与日记
      data.tasks = await pullCol('tasks', { assignee: OPENID });
      const siteIds = {}; const taskIds = {};
      data.tasks.forEach(t => { if (t.siteId && t.siteId !== 'other') siteIds[t.siteId] = 1; taskIds[t._id] = 1; });
      const allSites = await pullCol('sites');
      data.sites = allSites.filter(s => siteIds[s._id]);
      const allStages = await pullCol('stages');
      data.stages = allStages.filter(g => siteIds[g.siteId]);
      const allDelays = await pullCol('delays');
      data.delays = allDelays.filter(x => taskIds[x.taskId]);
      data.diaries = await pullCol('diaries', { author: OPENID });
      data.settings = await pullCol('settings');
      members = [{ openid: me.openid, name: me.name, role: me.role, status: me.status }];
    }
    let notes = [];
    try { notes = (await db.collection('notes').where({ to: OPENID, seen: false }).orderBy('ts', 'desc').limit(30).get()).data } catch (e) { }
    return { ok: true, me, members, data, notes };
  }

  if (act === 'redeem') {
    const exist = await getMember(OPENID);
    if (exist) return exist.status === 'active' ? { ok: true } : { ok: false, reason: 'disabled' };
    const code = (event.code || '').trim().toUpperCase();
    const r = await db.collection('invites').where({ code }).get();
    const inv = r.data[0];
    if (!inv) return { ok: false, reason: 'bad_code' };
    if (inv.usedBy) return { ok: false, reason: 'used' };
    if (inv.expiresAt < Date.now()) return { ok: false, reason: 'expired' };
    // 先建成员,成功后再作废邀请码(顺序不能反,否则码烧了人没进来)
    try {
      await db.collection('members').add({
        data: { _id: OPENID, openid: OPENID, name: (event.name || '').trim().slice(0, 20) || '成员', role: inv.role || 'admin', status: 'active', createdAt: Date.now(), quota: 0, prefs: { scope: 'mine', mode: 'now' } }
      });
    } catch (e) { return { ok: false, reason: 'network' } }
    await db.collection('invites').doc(inv._id).update({ data: { usedBy: OPENID, usedAt: Date.now() } });
    return { ok: true };
  }

  const me = await getMember(OPENID);
  if (!me || me.status !== 'active') return { ok: false, reason: 'not_member' };

  if (act === 'saveMany') {
    const items = event.items || [];
    const newFeed = []; const assigns = [];
    const isAdmin = me.role === 'admin';
    for (const it of items) {
      if (DATA_COLS.indexOf(it.col) < 0) continue;
      if (!isAdmin && MEMBER_COLS.indexOf(it.col) < 0) continue;
      const doc = Object.assign({}, it.doc);
      const id = doc._id || doc.id; if (!id) continue;
      doc._id = String(id); doc.updatedBy = OPENID; doc.updatedAt = Date.now();
      let old = null;
      try { old = (await db.collection(it.col).doc(doc._id).get()).data } catch (e) { old = null }
      const exists = !!old;
      if (!exists && !doc.createdBy) doc.createdBy = OPENID;
      // 员工校验:任务只能是自己的(建=归自己,改=原本就是自己的且不能改派);延迟只能记在自己任务上;日记只能是自己的;动态 actor 是自己
      if (!isAdmin) {
        if (it.col === 'tasks') {
          if (exists && old.assignee !== OPENID) continue;
          doc.assignee = OPENID;
        } else if (it.col === 'delays') {
          let t = null; try { t = (await db.collection('tasks').doc(String(doc.taskId)).get()).data } catch (e) { }
          if (!t || t.assignee !== OPENID) continue;
        } else if (it.col === 'diaries') {
          if (exists && old.author !== OPENID) continue;
          doc.author = OPENID;
        } else if (it.col === 'feed') {
          doc.actor = OPENID;
        }
      }
      const body = Object.assign({}, doc); delete body._id;
      let saved = false;
      try { await db.collection(it.col).doc(doc._id).set({ data: body }); saved = true; }
      catch (e) { try { await db.collection(it.col).add({ data: doc }); saved = true; } catch (e2) { } }
      if (!saved) continue;
      if (it.col === 'feed' && !exists) newFeed.push(doc);
      // 管理员指派/改派给别人 → 即时推送
      if (isAdmin && it.col === 'tasks' && doc.assignee && doc.assignee !== OPENID && (!exists || old.assignee !== doc.assignee)) assigns.push(doc);
    }
    for (const ev of newFeed) { try { await pushFeedNow(ev) } catch (e) { } }
    for (const t of assigns) { try { await pushAssign(t, me) } catch (e) { } }
    return { ok: true };
  }

  if (act === 'remove') {
    if (DATA_COLS.indexOf(event.col) < 0) return { ok: false, reason: 'forbidden' };
    const rid = String(event.id);
    let t = null;
    if (event.col === 'tasks') { try { t = (await db.collection('tasks').doc(rid).get()).data } catch (e) { } }
    if (me.role !== 'admin') {
      if (event.col !== 'tasks') return { ok: false, reason: 'forbidden' };
      if (t && (t.assignee !== OPENID || t.proc)) return { ok: false, reason: 'forbidden' };
    }
    try { await db.collection(event.col).doc(rid).remove() } catch (e) { }
    // 删任务时连带删它的延迟流水和动态(不留孤儿账)
    if (event.col === 'tasks') {
      try { await db.collection('delays').where({ taskId: rid }).remove() } catch (e) { }
      try { await db.collection('feed').where({ taskId: rid }).remove() } catch (e) { }
    }
    return { ok: true };
  }

  if (act === 'rename') {
    const nm = (event.name || '').trim().slice(0, 20);
    if (!nm) return { ok: false, reason: 'empty_name' };
    await db.collection('members').doc(OPENID).update({ data: { name: nm } });
    return { ok: true };
  }

  if (act === 'setPrefs') {
    const scope = ['none', 'mine', 'all'].indexOf(event.scope) >= 0 ? event.scope : 'mine';
    const mode = event.mode === 'digest' ? 'digest' : 'now';
    await db.collection('members').doc(OPENID).update({ data: { prefs: { scope, mode } } });
    return { ok: true };
  }

  if (act === 'subscribe') {   // 前端拿到一次性订阅额度后上报 +1
    await db.collection('members').doc(OPENID).update({ data: { quota: _.inc(1) } });
    const m = await getMember(OPENID);
    return { ok: true, quota: (m && m.quota) || 0 };
  }

  if (act === 'clearNotes') {
    try { await db.collection('notes').where({ to: OPENID, seen: false }).update({ data: { seen: true } }) } catch (e) { }
    return { ok: true };
  }

  if (act === 'cronStatus') {
    let last = 0;
    try { last = (await db.collection('settings').doc('cron').get()).data.last || 0 } catch (e) { }
    return { ok: true, last };
  }

  if (act === 'invite') {
    if (me.role !== 'admin') return { ok: false, reason: 'not_admin' };
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    const role = event.role === 'admin' ? 'admin' : 'member';
    await db.collection('invites').add({
      data: { code, role, createdBy: OPENID, expiresAt: Date.now() + 24 * 3600 * 1000, usedBy: '' }
    });
    return { ok: true, code, role };
  }

  if (act === 'setMember') {   // 管理员改角色/停用/恢复;不能对自己操作
    if (me.role !== 'admin') return { ok: false, reason: 'not_admin' };
    const target = String(event.openid || '');
    if (!target || target === OPENID) return { ok: false, reason: 'self' };
    const patch = {};
    if (event.role === 'admin' || event.role === 'member') patch.role = event.role;
    if (event.status === 'active' || event.status === 'disabled') patch.status = event.status;
    if (!Object.keys(patch).length) return { ok: false, reason: 'nothing' };
    try { await db.collection('members').doc(target).update({ data: patch }) } catch (e) { return { ok: false, reason: 'network' } }
    return { ok: true };
  }

  return { ok: false, reason: 'unknown_action' };
};
