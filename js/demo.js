// 示例数据：全部虚构（地址、工地名、金额都不是真实项目）。日期相对"今天"生成，所以演示永远是活的。
(function (global) {
  function build(S) {
    var td = S.today();
    var D = function (n) { return S.addDays(td, n) };
    var seq = 100;
    var sites = [], stages = [], tasks = [], delays = [], diaries = [];
    function site(name, addr, start, tag, note) {
      var id = 's' + (++seq);
      sites.push({ id: id, name: name, addr: addr, start: start, status: 'active', tag: tag, note: note, noteDate: note ? D(-1) : '' });
      return id;
    }
    var ord = 0;
    function stg(siteId, name, status, parent) {
      var id = 'g' + (++seq);
      stages.push({ id: id, siteId: siteId, name: name, order: ord++, parent: parent || null, status: status, actualStart: null, actualEnd: null });
      return id;
    }
    function task(siteId, stageId, name, o) {
      o = o || {};
      var t = {
        id: 't' + (++seq), siteId: siteId, stageId: stageId, name: name,
        desc: o.desc || '', proc: !!o.proc, st: o.st || 'todo',
        planDate: o.plan || o.date || '', currDate: o.date || '',
        doneDate: o.done || null, waitSince: o.waitSince || null
      };
      tasks.push(t); return t;
    }
    function delay(t, days, reason, date) {
      delays.push({ id: 'dl' + (++seq), taskId: t.id, siteId: t.siteId, stageId: t.stageId, days: days, reason: reason, date: date });
    }

    // ---- 1. Maple Ave 双户新建：结构阶段进行中，外墙并行；有一条延迟记录 ----
    ord = 0;
    var sA = site('Maple Ave 双户新建', '12-34 Maple Ave, Queens NY（示例）', D(-120), '在建', '二楼楼板下周浇筑，等钢筋到场');
    stg(sA, '图纸与设计', 'done'); stg(sA, '拆除', 'done'); stg(sA, '地基', 'done');
    var sA_st = stg(sA, '结构', 'current');
    var sA_wall = stg(sA, '外墙', 'current', sA_st);   // 并入结构，成为并行子阶段
    stg(sA, '水电', 'pending'); stg(sA, '内装', 'pending'); stg(sA, '验收与CO', 'pending');
    task(sA, sA_st, '一楼墙体砌筑', { proc: true, st: 'done', date: D(-9), done: D(-9) });
    var tA1 = task(sA, sA_st, '二楼钢筋绑扎', { proc: true, date: D(0), plan: D(-2), desc: '钢筋 ' + S.fmtShort(D(-1)) + ' 到场，比原计划晚两天' });
    task(sA, sA_st, '二楼楼板浇筑', { proc: true, date: D(3), plan: D(1) });
    task(sA, sA_st, '浇筑后养护 3 天', { proc: true, date: D(6), plan: D(4) });
    task(sA, sA_st, '拍钢筋间距照片存档', { date: D(0), desc: '给结构师发一份' });
    task(sA, sA_wall, '外墙保温板下单', { st: 'done', date: D(-1), done: D(-1) });
    task(sA, sA_wall, '外墙保温板到场验收', { date: D(5) });
    delay(tA1, 2, '钢筋供应商晚到', D(-1));

    // ---- 2. Linden St 翻建：内装阶段；有挂起和待定任务 ----
    ord = 0;
    var sB = site('Linden St 翻建', '56-78 Linden St, Queens NY（示例）', D(-200), '在建', '厨房柜体等报价，水电已过检');
    stg(sB, '图纸与设计', 'done'); stg(sB, '拆除', 'done'); stg(sB, '地基', 'done'); stg(sB, '结构', 'done');
    stg(sB, '外墙', 'done'); stg(sB, '水电', 'done');
    var sB_in = stg(sB, '内装', 'current');
    stg(sB, '验收与CO', 'pending');
    task(sB, sB_in, '石膏板封墙', { proc: true, st: 'done', date: D(-2), done: D(-1) });
    task(sB, sB_in, '腻子+底漆', { proc: true, date: D(-1), desc: '昨天没干完，今天收尾' });
    task(sB, sB_in, '厨房柜体安装', { proc: true, date: D(8) });
    task(sB, sB_in, '等厨房柜体报价', { st: 'wait', waitSince: D(-5), date: D(-5), desc: 'Mike 说这周给，已催两次' });
    task(sB, sB_in, '选地板颜色', { date: '', desc: '等老板看样品，日期待定' });
    task(sB, sB_in, '约水电复检', { date: D(2) });

    // ---- 3. Cedar Pl 二户：等 CO ----
    ord = 0;
    var sC = site('Cedar Pl 二户', '90-12 Cedar Pl, Queens NY（示例）', D(-320), '等CO', '等 CO 与 Final Survey，已交齐材料');
    stg(sC, '施工阶段（已完）', 'done');
    var sC_co = stg(sC, '验收与CO', 'current');
    task(sC, sC_co, '等 CO', { st: 'wait', waitSince: D(-12), date: D(-12) });
    task(sC, sC_co, '等 Final Survey', { st: 'wait', waitSince: D(-12), date: D(-12) });
    task(sC, sC_co, '电气 sign-off', { st: 'done', date: D(-14), done: D(-14) });
    task(sC, sC_co, '补交 smoke letter', { st: 'done', date: D(-13), done: D(-13) });

    // ---- 4. Oak Ct 旧房：在售 ----
    ord = 0;
    var sD = site('Oak Ct 旧房', '34-56 Oak Ct, Queens NY（示例）', D(-400), '在售', '挂牌中，周末 open house');
    stg(sD, '施工阶段（已完）', 'done'); stg(sD, '验收与CO', 'done');
    var sD_sell = stg(sD, '销售', 'current');
    task(sD, sD_sell, '周六 open house 2-4pm', { date: D(2), desc: '经纪人 Lisa 带看' });
    task(sD, sD_sell, '换门口的 for sale 牌', { st: 'done', date: D(-3), done: D(-3) });

    // ---- 其他事项（不挂工地） ----
    task('other', null, '交保险续费', { date: D(1), desc: '网上交，记得留收据' });
    task('other', null, '每周查车位', { date: D(-1) });

    // ---- 日记 ----
    diaries.push({
      id: 'd' + D(-1), date: D(-1), weather: '晴',
      blocks: [
        { siteId: sB, workers: '油工2', events: '腻子打了一半，明天收尾。Mike 的柜体报价还没来。', orders: '', spend: '$40 午饭', showing: '' },
        { siteId: sA, workers: '钢筋工3', events: '钢筋到场，比原计划晚两天，二楼绑扎顺延。', orders: '保温板已到', spend: '', showing: '' }
      ],
      tomorrow: [{ text: '催 Mike 柜体报价', cv: false }, { text: '给结构师发钢筋照片', cv: false }]
    });
    diaries.push({
      id: 'd' + D(-4), date: D(-4), weather: '多云',
      blocks: [
        { siteId: sA, workers: '砌墙4', events: '一楼墙体完工，验收通过。', orders: '订了二楼钢筋，' + S.fmtShort(D(-1)) + '到', spend: '', showing: '' },
        { siteId: sD, workers: '', events: '', orders: '', spend: '', showing: 'Lisa 带了两组客人，一组说再考虑' }
      ],
      tomorrow: []
    });

    return {
      sites: sites, stages: stages, tasks: tasks, delays: delays, diaries: diaries,
      template: ['图纸与设计', '拆除', '地基', '结构', '外墙', '水电', '内装', '验收与CO'],
      quick: ['联系材料送货', '约检查员', '安排工人进场', '催报价'], seq: 1
    };
  }
  global.DEMO = { build: build };
})(window);
