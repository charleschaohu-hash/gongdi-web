// 中英界面文字。键 = 中文原文，值 = 英文；找不到的键原样返回中文。
// t('今日 {n} 项', {n: 3}) 做占位替换。
(function (global) {
  var KEY = 'gd_lang';
  var EN = {
    // nav / tabs
    '工地进度': 'Site Tracker', '工地': 'Sites', '今日': 'Today', '日记': 'Diary', '日历': 'Calendar', '设置': 'Settings',
    '新建工地': 'New site', '修改日期': 'Change date', '编辑任务': 'Edit task', '添加任务': 'Add task',
    // sites
    '列表': 'List', '总览': 'Overview',
    '还没有工地。点下面新建第一个，阶段模板会自动带出。': 'No sites yet. Create the first one below — the stage template is applied automatically.',
    '今日 {n} 项': '{n} due today', '今日无事': 'Nothing today', '未填地址': 'No address', '当前：': 'Now: ',
    '任务完成 {pct}%': '{pct}% of tasks done', ' · 累计延迟{n}天': ' · {n} days behind in total', '＋ 新建工地': '+ New site',
    '{n}个工地 · {a}在建 · {b}等CO · {c}在售 · 点任意行跳到该工地': '{n} sites · {a} building · {b} awaiting CO · {c} for sale · tap a row to open',
    '在售 · 不在管线内': 'for sale · out of pipeline', '完成': 'done', '进行中': 'in progress', '并行': 'parallel', '等待中': 'waiting',
    '在建': 'Building', '等CO': 'Awaiting CO', '在售': 'For sale', '工地状态': 'Site status',
    // new site
    '名称': 'Name', '例：Newark Ave 项目': 'e.g. Newark Ave project', '地址（可空）': 'Address (optional)', '例：120 Newark Ave, Jersey City': 'e.g. 120 Newark Ave, Jersey City',
    '开工日期': 'Start date', '阶段（默认模板 · 可删可加）': 'Stages (from template · edit freely)', '加一个自定义阶段': 'Add a custom stage', '加': 'Add',
    '创建工地': 'Create site', '先填工地名称': 'Enter a site name first', '至少保留一个阶段': 'Keep at least one stage',
    // timeline
    '点这里写一句现状便签，如：等CO和final survey': 'Tap to write a one-line status note, e.g. waiting on CO and final survey',
    '{d} 更新': 'updated {d}', '开工 {d} · ': 'started {d} · ', '累计延迟{n}天': '{n} days behind in total', '未延迟': 'on schedule',
    '现状便签': 'Status note', '一句话描述这个工地现在的状态': 'One line on where this site stands right now',
    '已完成': 'Done', '未开始': 'Not started', '并入…': 'Merge into…', '恢复独立': 'Unmerge', '（并行子阶段）': ' (parallel sub-stage)', ' 含': ' incl. ',
    '未排期 · 点开添加任务': 'Not scheduled · open to add tasks', '{n}个任务 · 全部完成': '{n} tasks · all done',
    '{n}个进行中 · 日期待定': '{n} open · dates TBD', '{n}个进行中 · 最近 {d}': '{n} open · next {d}',
    '＋ 添加任务': '+ Add task', '{d} 完成': 'done {d}', '预计 {d}': 'expected {d}', ' · 原计划 {d}': ' · originally {d}', '日期待定': 'date TBD',
    '工序': 'process', '挂起': 'waiting', '它带着子阶段，先恢复它们': 'It has sub-stages — unmerge them first', '没有可并入的阶段': 'No stage to merge into',
    '并入哪个阶段（成为它的并行子阶段）': 'Merge into which stage (as a parallel sub-stage)?', '已并入「{n}」': 'Merged into "{n}"',
    '标为已完成': 'Mark done', '标为进行中': 'Mark in progress', '标为未开始': 'Mark not started', '「{n}」进入进行中': '"{n}" is now in progress',
    // task menu
    '恢复为未完成': 'Reopen', '恢复为待办': 'Back to to-do', '转为挂起 · 等待中': 'Put on hold · waiting', '编辑详情': 'Edit details', '删除': 'Delete',
    '已完成并归档': 'Done and archived', '已转入挂起区': 'Moved to waiting',
    '「{s}」阶段的工序已全部完成，已标为完成': 'All process steps in "{s}" are done — stage marked complete',
    '；「{n}」进入进行中。': '; "{n}" is now in progress.', '。': '.', '阶段完成': 'Stage complete', '好': 'OK',
    '删除「{n}」？': 'Delete "{n}"?', '\n这是工序任务，将同时删除它的 {n} 条延迟记录。': '\nThis is a process step; its {n} delay record(s) will be deleted too.',
    '\n这是工序任务。': '\nThis is a process step.', '删除任务': 'Delete task', '确定删除？': 'Delete this task?',
    '「{n}」完成了，接下来有什么安排？': '"{n}" is done — what\'s next?', '自定义…': 'Custom…',
    // today
    '{n} 项待办 · {w} 挂起 · {p} 待定': '{n} to do · {w} waiting · {p} TBD', '全部': 'All', '其他': 'Other', '其他事项': 'Other items',
    '今日任务 · 点任务弹出操作': 'Due today · tap a task for actions', '今天没有任务': 'Nothing due today',
    ' · 已逾期{n}天': ' · {n} days overdue', ' · 今天完成': ' · done today', '进行中 · 挂起 · 待定': 'On hold · waiting · TBD',
    '没有挂起或待定的事项': 'Nothing waiting or TBD', ' · 日期未定': ' · no date yet', ' · 已等待{n}天': ' · waiting {n} days', '待定': 'TBD',
    '即将到来': 'Coming up', '暂无': 'None', '明天': 'tomorrow', '还有{n}天': 'in {n} days', '＋ 给 {s} 添加任务': '+ Add task for {s}',
    '已归档 · {n} 条': 'Archived · {n}', '{y}年{m}月': '{mon} {y}',
    // calendar
    '‹ 上月': '‹ Prev', '下月 ›': 'Next ›', '一': 'Mo', '二': 'Tu', '三': 'We', '四': 'Th', '五': 'Fr', '六': 'Sa', '日': 'Su',
    '计划': 'planned', '逾期': 'overdue', '已逾期': 'Overdue', '这天没有任务': 'No tasks this day',
    // diary
    '✎ 继续写今天的日记': '✎ Continue today\'s diary', '✎ 写今天的日记': '✎ Write today\'s diary',
    '还没有日记。每天的任务完成和延迟会自动带进当天的日记里，你只补人数、事件、订货这些。': 'No diary yet. Each day\'s completions and delays are pulled in automatically — you add headcount, events, orders.',
    '未记工地': 'no site', '明日事项 {n} 条': '{n} item(s) for tomorrow', '天气（可空）': 'Weather (optional)',
    '系统记录 · 自动带入': 'System log · auto', '✓ {n} · 完成': '✓ {n} · done', '⏱ {n} · 记延迟{d}天': '⏱ {n} · {d}-day delay', '任务': 'task',
    '人数（如：砌砖2、杂活3）': 'Headcount (e.g. masons 2, labor 3)', '留空跳过': 'leave blank to skip', '事件': 'Events', '今天发生了什么，自由写': 'What happened today — free text',
    '订货': 'Orders', '花销': 'Spend', '如：$40 小费·现金': 'e.g. $40 tip · cash', '看房': 'Showings', '经纪人、客人反应、意向（留空跳过）': 'Agent, buyer reactions, interest (optional)',
    '＋ 添加工地板块': '+ Add a site block', '跟进中 · 挂起任务': 'Following up · waiting tasks', '明日事项': 'Tomorrow', '转为任务': 'Make task', '✓ 已转': '✓ made',
    '写一条明天要做的事': 'Something to do tomorrow', '保存日记': 'Save diary', '日记已保存': 'Diary saved', '所有工地都已添加': 'All sites already added',
    '还没有工地，先记在「其他」；新建工地后可按工地分块': 'No sites yet — logged under "Other"; add sites to split by site',
    '添加哪个工地的板块': 'Add a block for which site?', '移除板块': 'Remove block', '移除这个工地板块？已写的内容会丢失。': 'Remove this site block? Its text will be lost.', '移除': 'Remove',
    // task edit
    '任务名': 'Task', '例：砌三楼砖': 'e.g. Lay 3rd-floor brick', '备注（可空）': 'Notes (optional)', '例：砖用上次那家，联系 Mike 917-xxx': 'e.g. same brick supplier, call Mike 917-xxx',
    '归属': 'Site', '其他（不挂工地）': 'Other (no site)', '阶段': 'Stage', '日期待定（不进今日和日历，只留在 timeline）': 'Date TBD (hidden from Today and Calendar, stays on timeline)',
    '工序任务已有日期，不可改为待定；要改期请走"修改日期"。': 'A dated process step can\'t go back to TBD; use "Change date".', '日期': 'Date',
    '工序任务（改期记延迟并顺延后续）': 'Process step (delays are logged and cascade)', '保存': 'Save', '先填任务名': 'Enter a task name', '该工地没有阶段': 'This site has no stages',
    '先选日期或打开"日期待定"': 'Pick a date or switch on "Date TBD"', '先选日期': 'Pick a date',
    '日期（当前 {c}{p}）': 'Date (now {c}{p})', '，原计划 {d}': ', originally {d}', '待定': 'TBD',
    '延迟原因（可空，如：下雨、材料没到）': 'Reason for delay (optional, e.g. rain, materials late)', '往后改期时记入延迟流水': 'logged when the date moves later',
    '工序任务：往后改会自动记一条延迟，并顺延同阶段后续未完成工序；往前改视为提前，不记延迟。': 'Process step: moving later logs a delay and pushes every later open step in this stage by the same days; moving earlier is just ahead of schedule.',
    '确定': 'OK', '取消': 'Cancel', '已顺延{n}天，延迟已记录': 'Pushed {n} days — delay logged', '日期已更新': 'Date updated',
    // settings
    '阶段模板 · 新建工地时带出': 'Stage template · applied to new sites', '加一个阶段': 'Add a stage', '下一步快捷按钮 · 工序完成后弹出': 'Quick next-step buttons · shown after a process step is done', '加一个快捷按钮': 'Add a button',
    '数据': 'Data', '网页演示版：数据只存在这个浏览器里（localStorage），不会上传。关掉再开还在，换浏览器就没有。小程序正式版的数据在公司云端多人共享，带白名单门禁、任务指派和微信推送提醒。': 'Web demo: data lives only in this browser (localStorage) and is never uploaded. It survives a reload; another browser starts fresh. The production mini program keeps data in the company cloud, shared by the team, with whitelist access, task assignment and WeChat push reminders.',
    '重置为示例数据': 'Reset to sample data', '清空全部数据': 'Clear all data', '会覆盖当前浏览器里的全部数据，确定？': 'This replaces everything in this browser. Continue?', '已载入示例数据': 'Sample data loaded',
    '清空后从零开始，确定？': 'Start from scratch?', '清空': 'Clear', '已清空': 'Cleared', '关于': 'About',
    '工地进度 · 小型建筑/翻建团队的进度管理工具。核心规则：工序任务改期自动记延迟并顺延同阶段后续工序；原计划 / 当前计划 / 实际完成三条日期并存；日期可空=待定；挂起任务显示已等待天数；工序全部完成自动推进阶段；日记自动带入当天的完成与延迟记录。': 'Site Tracker · progress tracking for a small construction / rebuild crew. Rules: moving a process step later logs a delay and cascades to later steps in the stage; original / current / actual dates are kept side by side; a missing date means TBD; waiting tasks show their age; a stage closes itself when all its tasks are done; the diary pulls in each day\'s completions and delays.',
    '原生微信小程序，此为网页移植版。': 'Native WeChat mini program; this is the web port. ', '源码 ↗': 'Source ↗', '语言': 'Language',
    // defaults (data)
    '图纸与设计': 'Drawings & design', '拆除': 'Demolition', '地基': 'Foundation', '结构': 'Structure', '外墙': 'Exterior', '水电': 'MEP', '内装': 'Interior', '验收与CO': 'Inspections & CO',
    '联系材料送货': 'Call material delivery', '约检查员': 'Book inspector', '安排工人进场': 'Schedule crew', '催报价': 'Chase quote',
    // desk note
    '小型建筑 / 翻建团队的进度管理工具。原生微信小程序，这里是网页版演示。': 'Progress tracking for a small construction / rebuild crew. A native WeChat mini program — this is the web demo.',
    '示例数据全部虚构，日期按今天生成；你的改动只存在这个浏览器里。': 'Sample data is fictional and dated relative to today; your edits stay in this browser.',
    '源码 · GitHub ↗': 'Source on GitHub ↗'
  };
  var lang = localStorage.getItem(KEY) || ((navigator.language || '').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en');
  function t(key, vars) {
    var s = (lang === 'en' && EN.hasOwnProperty(key)) ? EN[key] : key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]) });
    if (lang === 'en') s = s.replace(/\b1 (days|tasks|sites|items?)\b/g, function (m, w) { return '1 ' + w.replace(/s$/, '') });
    return s;
  }
  function set(l) { lang = l; try { localStorage.setItem(KEY, l) } catch (e) {} }
  global.I18N = { t: t, get lang() { return lang }, set: set };
})(window);
