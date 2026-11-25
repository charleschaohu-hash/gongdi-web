# 原版微信小程序源码（v4.8，云开发版）

这是网页版移植前的原始代码，供对照阅读。网页版的 `js/store.js` 就是从这里的 `miniprogram/utils/store.js` 改来的，业务规则一行没动。

- `miniprogram/` — 小程序前端：`app.json`（5 个 tab）、`pages/`（9 个页面，WXML/WXSS/JS）、`utils/store.js`（数据层：内存缓存 + 本地镜像 + 离线队列 + 云端同步）
- `cloudfunctions/api/` — 唯一后端入口云函数：按 openid 白名单校验，动作 boot / redeem / saveMany / remove / invite / rename / setMember / setPrefs / subscribe / cronStatus；`config.json` 里的定时触发器每 15 分钟跑一次推送
- 已去掉：`utils/realdata.js`（公司真实工地的种子数据）；`app.js` 里的云环境 ID 和订阅消息模板 ID 换成了占位符

和网页版的差别：多人共享云端数据、白名单 + 邀请码门禁、管理员/员工分级（员工只看指派给自己的任务）、任务指派、微信订阅消息提醒（任务到期前推送、他人完成/延迟任务时推送）。这些都依赖微信生态，网页版没有实现。
