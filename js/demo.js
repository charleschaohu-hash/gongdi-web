// 示例数据：全部虚构（地址、工地名、金额都不是真实项目）。日期相对"今天"生成，所以演示永远是活的。
// 中英两套文案，按当前语言生成。
(function (global) {
  function build(S, lang) {
    var en = lang === 'en';
    var L = function (zh, enS) { return en ? enS : zh };
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
    var T = {
      design: L('图纸与设计', 'Drawings & design'), demo: L('拆除', 'Demolition'), found: L('地基', 'Foundation'), struct: L('结构', 'Structure'),
      ext: L('外墙', 'Exterior'), mep: L('水电', 'MEP'), int: L('内装', 'Interior'), co: L('验收与CO', 'Inspections & CO'),
      doneAll: L('施工阶段（已完）', 'Construction (done)'), sales: L('销售', 'Sales')
    };
    var ex = L('（示例）', ' (sample)');

    // ---- 1. Maple Ave：结构阶段进行中，外墙并行；有一条延迟记录 ----
    ord = 0;
    var sA = site(L('Maple Ave 双户新建', 'Maple Ave two-family'), '12-34 Maple Ave, Queens NY' + ex, D(-120), '在建',
      L('二楼楼板下周浇筑，等钢筋到场', 'Pouring 2nd-floor slab next week, waiting on rebar'));
    stg(sA, T.design, 'done'); stg(sA, T.demo, 'done'); stg(sA, T.found, 'done');
    var sA_st = stg(sA, T.struct, 'current');
    var sA_wall = stg(sA, T.ext, 'current', sA_st);   // 并入结构，成为并行子阶段
    stg(sA, T.mep, 'pending'); stg(sA, T.int, 'pending'); stg(sA, T.co, 'pending');
    task(sA, sA_st, L('一楼墙体砌筑', '1st-floor masonry'), { proc: true, st: 'done', date: D(-9), done: D(-9) });
    var tA1 = task(sA, sA_st, L('二楼钢筋绑扎', '2nd-floor rebar'), { proc: true, date: D(0), plan: D(-2), desc: L('钢筋 ' + S.fmtShort(D(-1)) + ' 到场，比原计划晚两天', 'Rebar arrived ' + S.fmtShort(D(-1)) + ', two days late') });
    task(sA, sA_st, L('二楼楼板浇筑', 'Pour 2nd-floor slab'), { proc: true, date: D(3), plan: D(1) });
    task(sA, sA_st, L('浇筑后养护 3 天', 'Cure 3 days'), { proc: true, date: D(6), plan: D(4) });
    task(sA, sA_st, L('拍钢筋间距照片存档', 'Photograph rebar spacing'), { date: D(0), desc: L('给结构师发一份', 'Send a copy to the engineer') });
    task(sA, sA_wall, L('外墙保温板下单', 'Order exterior insulation'), { st: 'done', date: D(-1), done: D(-1) });
    task(sA, sA_wall, L('外墙保温板到场验收', 'Receive & check insulation'), { date: D(5) });
    delay(tA1, 2, L('钢筋供应商晚到', 'Rebar supplier late'), D(-1));

    // ---- 2. Linden St：内装阶段；有挂起和待定任务 ----
    ord = 0;
    var sB = site(L('Linden St 翻建', 'Linden St rebuild'), '56-78 Linden St, Queens NY' + ex, D(-200), '在建',
      L('厨房柜体等报价，水电已过检', 'Waiting on cabinet quote; MEP passed inspection'));
    stg(sB, T.design, 'done'); stg(sB, T.demo, 'done'); stg(sB, T.found, 'done'); stg(sB, T.struct, 'done');
    stg(sB, T.ext, 'done'); stg(sB, T.mep, 'done');
    var sB_in = stg(sB, T.int, 'current');
    stg(sB, T.co, 'pending');
    task(sB, sB_in, L('石膏板封墙', 'Hang drywall'), { proc: true, st: 'done', date: D(-2), done: D(-1) });
    task(sB, sB_in, L('腻子+底漆', 'Skim coat + primer'), { proc: true, date: D(-1), desc: L('昨天没干完，今天收尾', 'Not finished yesterday, wrap up today') });
    task(sB, sB_in, L('厨房柜体安装', 'Install kitchen cabinets'), { proc: true, date: D(8) });
    task(sB, sB_in, L('等厨房柜体报价', 'Waiting on cabinet quote'), { st: 'wait', waitSince: D(-5), date: D(-5), desc: L('Mike 说这周给，已催两次', 'Mike said this week; chased twice') });
    task(sB, sB_in, L('选地板颜色', 'Pick flooring color'), { date: '', desc: L('等老板看样品，日期待定', 'Owner to review samples, date TBD') });
    task(sB, sB_in, L('约水电复检', 'Book MEP re-inspection'), { date: D(2) });

    // ---- 3. Cedar Pl：等 CO ----
    ord = 0;
    var sC = site(L('Cedar Pl 二户', 'Cedar Pl two-family'), '90-12 Cedar Pl, Queens NY' + ex, D(-320), '等CO',
      L('等 CO 与 Final Survey，已交齐材料', 'Waiting on CO and final survey; paperwork submitted'));
    stg(sC, T.doneAll, 'done');
    var sC_co = stg(sC, T.co, 'current');
    task(sC, sC_co, L('等 CO', 'Waiting on CO'), { st: 'wait', waitSince: D(-12), date: D(-12) });
    task(sC, sC_co, L('等 Final Survey', 'Waiting on final survey'), { st: 'wait', waitSince: D(-12), date: D(-12) });
    task(sC, sC_co, L('电气 sign-off', 'Electrical sign-off'), { st: 'done', date: D(-14), done: D(-14) });
    task(sC, sC_co, L('补交 smoke letter', 'Submit smoke letter'), { st: 'done', date: D(-13), done: D(-13) });

    // ---- 4. Oak Ct：在售 ----
    ord = 0;
    var sD = site(L('Oak Ct 旧房', 'Oak Ct house'), '34-56 Oak Ct, Queens NY' + ex, D(-400), '在售',
      L('挂牌中，周末 open house', 'Listed; open house this weekend'));
    stg(sD, T.doneAll, 'done'); stg(sD, T.co, 'done');
    var sD_sell = stg(sD, T.sales, 'current');
    task(sD, sD_sell, L('周六 open house 2-4pm', 'Saturday open house 2–4pm'), { date: D(2), desc: L('经纪人 Lisa 带看', 'Agent Lisa showing') });
    task(sD, sD_sell, L('换门口的 for sale 牌', 'Replace for-sale sign'), { st: 'done', date: D(-3), done: D(-3) });

    // ---- 其他事项 ----
    task('other', null, L('交保险续费', 'Pay insurance renewal'), { date: D(1), desc: L('网上交，记得留收据', 'Pay online, keep the receipt') });
    task('other', null, L('每周查车位', 'Weekly parking check'), { date: D(-1) });

    // ---- 日记 ----
    diaries.push({
      id: 'd' + D(-1), date: D(-1), weather: L('晴', 'Sunny'),
      blocks: [
        { siteId: sB, workers: L('油工2', 'painters 2'), events: L('腻子打了一半，明天收尾。Mike 的柜体报价还没来。', 'Skim coat half done, finishing tomorrow. Still no cabinet quote from Mike.'), orders: '', spend: L('$40 午饭', '$40 lunch'), showing: '' },
        { siteId: sA, workers: L('钢筋工3', 'rebar crew 3'), events: L('钢筋到场，比原计划晚两天，二楼绑扎顺延。', 'Rebar arrived two days late; 2nd-floor tying pushed back.'), orders: L('保温板已到', 'Insulation delivered'), spend: '', showing: '' }
      ],
      tomorrow: [{ text: L('催 Mike 柜体报价', 'Chase Mike for cabinet quote'), cv: false }, { text: L('给结构师发钢筋照片', 'Send rebar photos to engineer'), cv: false }]
    });
    diaries.push({
      id: 'd' + D(-4), date: D(-4), weather: L('多云', 'Cloudy'),
      blocks: [
        { siteId: sA, workers: L('砌墙4', 'masons 4'), events: L('一楼墙体完工，验收通过。', '1st-floor walls done, passed inspection.'), orders: L('订了二楼钢筋，' + S.fmtShort(D(-1)) + '到', 'Ordered 2nd-floor rebar, due ' + S.fmtShort(D(-1))), spend: '', showing: '' },
        { siteId: sD, workers: '', events: '', orders: '', spend: '', showing: L('Lisa 带了两组客人，一组说再考虑', 'Lisa brought two parties; one is thinking it over') }
      ],
      tomorrow: []
    });

    return {
      sites: sites, stages: stages, tasks: tasks, delays: delays, diaries: diaries,
      template: [T.design, T.demo, T.found, T.struct, T.ext, T.mep, T.int, T.co],
      quick: [L('联系材料送货', 'Call material delivery'), L('约检查员', 'Book inspector'), L('安排工人进场', 'Schedule crew'), L('催报价', 'Chase quote')], seq: 1
    };
  }
  global.DEMO = { build: build };
})(window);
