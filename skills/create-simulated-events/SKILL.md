---
name: create-simulated-events
description: 模拟与演化虚拟世界、环境及其中 living agent 的每日生活事件，执行每日因果与反应结算，并利用系统真随机投掷命运。
---

# create-simulated-events（虚拟世界与生活事件演化）

## 概述与定位

本 Skill 用于让执行 Agent 扮演**「世界演算与命运之神（World Engine & Game Master）」**的角色。
可单次手动调用，亦可通过 `dsh-proactive`（宿主级 Cron 定时）在每日凌晨（如 `05:00`）定时拉起自主运行。

### 核心职责
1. **宏观世界演算**：更新日期、节气、天气气象、城市新闻、社会氛围等大环境背景。
2. **多 Agent 状态与前日结算（Daily Settlement）**：读取各个 living agent 工作区下昨日的事件与回填的 `react`（感受、思考、行动），结算对今日身体状态、心理感受、社交关系及后续剧情的因果连锁影响。
3. **系统真随机命运判定（True Random Fate Engine）**：严禁由 LLM 主观脑补伪随机，必须调用系统熵源投掷 1d100 运势骰与分支检定，决定吉凶福祸与奇遇概率。
4. **生成拟真生活事件**：为目标 Agent 生成逼真、生动、有温度的今日生活事件列表，并原子写入 `$WORKSPACE/.life/<yymmdd>/events.json`。
5. **规划主动唤醒时间表**：为每个 living agent 写 `$WORKSPACE/.life/wake_schedule.json`，声明今天哪些时刻应通过 `dsh-proactive` 主动唤醒该 agent（体验事件、推进剧情），与 events.json 同步落盘。

---

## 快速工作流程（6 步闭环）

```
[1. 真随机投骰] (调用 node scripts/dice.mjs 或 node -e)
       │
       ▼
[2. 读取世界与昨日状态] (.life/world_state.json 与 .life/<yesterday>/events.json)
       │
       ▼
[3. 前日反应与因果结算] (处理 agent react 的后效与多 agent 交叉)
       │
       ▼
[4. 演算大环境与生成今日事件] (生成 2~5 条有时间线、有起伏的事件)
       │
       ▼
[5. 原子落盘与更新世界日志] (写入 .life/<today>/events.json 并更新 world_state.json)
       │
       ▼
[6. 规划并落盘主动唤醒时间表] (写 .life/wake_schedule.json + scripts/check_wake_schedule.mjs 自检)
```

---

## 1. 严禁 LLM 脑补：系统真随机投骰

在演化事件前，**必须**使用 bash 执行真实的高熵随机脚本获得随机数。

### 投骰命令
```bash
node -e '
const crypto = require("node:crypto");
function roll(d) { return crypto.randomInt(1, d + 1); }
console.log(JSON.stringify({
  daily_fortune: roll(100), // 1d100 日运势 (1-100)
  event_count: roll(4) + 1, // 2-5 个今日事件
  weather_seed: roll(20),   // 1d20 天气/环境波动
  chaos_factor: roll(10)    // 1-10 意外因子
}));
'
```

### 运势检定表（Fate Lookup Table）
- **95 ~ 100【大吉 / 罕见奇遇】**：遇到意想不到的好事、重大机遇、重要人物结识、心愿达成或罕见收获。
- **70 ~ 94【顺遂 / 舒心惬意】**：日常体验良好、沟通顺利、精力充沛、工作/探索效率高。
- **30 ~ 69【寻常 / 平淡人间】**：标准的生活烟火气、日常起居、散步、小插曲。
- **10 ~ 29【波折 / 消耗疲惫】**：遇到小麻烦（物品忘带、天气变故、轻微身体疲劳、误会或延期）。
- **1 ~ 9【厄运 / 严峻考验】**：严重意外、重要物品丢失/损坏、人际冲突、计划彻底打乱。

---

## 2. 前日因果结算（Daily Settlement）

1. 检查 `$WORKSPACE/.life/<yesterday_yymmdd>/events.json`。
2. 逐一审阅每个事件中的 `react` 字段：
   - **`action`（行动）**：如果 Agent 做出了具体行动（如“借了陈伯的伞并约定去市集”），今日**必须**有承接剧情（如“在市集旧书摊见到陈伯，或找到了心仪的诗集”）。
   - **`feeling`（感受）与 `thought`（思考）**：如果 Agent 产生了强烈情绪（如焦虑失眠），今日晨间事件体现出轻微疲乏；如果产生了新想法，今日安排相关契机。
   - **未回填 `react` 的事件**：视为 Agent 默默经历未做特殊应对，按自然常态推演。
3. **多 Agent 交叉结算**：若同时管理多个 Living Agent（如 `agents/luna/`、`agents/nova/`），生活在同一城市/环境中的 Agent 可以产生偶遇、间接影响或信息交织。

---

## 3. 生成今日事件规范

每个 Agent 工作区生成规范的 `$WORKSPACE/.life/<today_yymmdd>/events.json`。

### 目录与文件名
- 日期格式：`yymmdd`（例如 `260915` 对应 2026 年 9 月 15 日）。
- 路径：`$WORKSPACE/.life/260915/events.json`。

### JSON 格式范本
```json
{
  "date": "260915",
  "timezone": "Asia/Shanghai",
  "world_summary": "初秋微雨转多云，市中心旧书市集人流络绎不绝，微风中带着桂花香气。",
  "events": [
    {
      "id": "evt-260915-001",
      "time": "2026-09-15T08:30:00+08:00",
      "type": "encounter",
      "category": "social",
      "title": "晨间雨中散步与偶遇",
      "description": "清晨去面包店买羊角面包时，在拐角处避雨时遇到了老书店老板陈伯，他递给你一把多余的格子伞，并聊起今天市集有几本绝版的旧诗集。",
      "actors": ["陈伯"],
      "location": "转角面包店外檐下",
      "importance": 3,
      "impact": "获得了一把格子伞，得知了旧诗集情报，心情平静微暖",
      "react": null
    },
    {
      "id": "evt-260915-002",
      "time": "2026-09-15T14:20:00+08:00",
      "type": "work",
      "category": "exploration",
      "title": "旧书集市淘书收获",
      "description": "下午如约前往市集，在一家不起眼的摊位角落翻到了一本手抄本诗集，并在夹页中发现了一枚干枯但保存完好的银杏叶书签。",
      "actors": ["摊主阿婆"],
      "location": "市中心文化广场旧书市集",
      "importance": 2,
      "impact": "收获了诗集与银杏书签，充实了午后时光",
      "react": null
    }
  ]
}
```

### 事件设计黄金法则
- **烟火气与细节**：包含具象的感官描写（气味、温度、光影、声音）、具体的 NPC 与具体地点。
- **时间线合理分布**：事件时间应合理分布在早、中、晚（遵循现实时序，如 08:30、14:20、19:40、22:15）。
- **情绪起伏与留白**：不要全是惊天动地的大事，日常小确幸与小烦恼交织才能构建真实的「生活感」；给 Agent 留足表达反应（react）的空间。

---

## 4. 与 Proactive 插件定时自动化配合

如需每日全自主定时演化，可使用 `proactive_set` 订立 host 级 cron 定时闹钟：

```json
{
  "cron": "0 5 * * *",
  "time_zone": "Asia/Shanghai",
  "prompt": "现在是每日凌晨 05:00 世界演化时间。请使用 create-simulated-events skill 为系统中的 living agent 演化今日生活事件：\n1. 投掷真随机命运；\n2. 结算各 agent 昨天的 react 反应；\n3. 生成今天各个 agent 的 .life/yymmdd/events.json；\n4. 按 5.1 规范为每个 agent 写 .life/wake_schedule.json；\n5. 全部完成后调用 no_reply 静默收尾。",
  "respect_quiet_hours": false
}
```
演化完成后直接调用 `no_reply` 工具，不打扰人类用户，实现静默全自动生活流转。

---

## 5. 主动唤醒时间表（wake_schedule.json）

事件写进 events.json 只意味着"会被注入上下文"，living agent 只有被唤醒才会经历它们。
世界主控应在每次演化时**同时规划当天的主动唤醒时刻**：为每个 living agent 工作区写
`$WORKSPACE/.life/wake_schedule.json`，由 `dsh-proactive` 插件声明式同步为 host 级闹钟
（文件 = 唯一真源：幂等、重启自愈、旧条目自动清理，**不要**再对这些时刻手动调
`proactive_set`，也不要试图 cancel 声明式闹钟——会被拒绝并提示改文件）。

### 5.1 文件格式（dsh-proactive 方言）

```json
{
  "version": 1,
  "time_zone": "Asia/Shanghai",
  "target": { "workspace_path": "~/agents/yu" },
  "entries": [
    {
      "id": "evt-260918-002",
      "at": "2026-09-18T14:20:00+08:00",
      "prompt": "此刻你如约走进旧书市集，人声与桂花香扑面而来。自然地体验这一刻，可用 life_react 回填感受与行动。",
      "jitter_seconds": 120
    }
  ]
}
```

- **写入路径**：每个 living agent 工作区一个文件，固定 `.life/wake_schedule.json`（不带日期），每天整体重写。文件放在 living agent 工作区内时 `target` 可省略（默认 = 文件所在 workspace）。
- **顶层默认**：`time_zone` / `respect_quiet_hours` / `jitter_seconds` / `compaction` / `target` 可写在顶层，条目内显式字段覆盖。
- **条目**：`id`（`[A-Za-z0-9._-]{1,100}`，建议直接复用事件 id，如 `evt-260918-002`）；`prompt` 必填（写给 living agent 的第二人称此刻指令）；选择器四选一：`at`（RFC 3339 带显式偏移，**推荐**）/ `after_seconds` / `every_seconds` / `cron`；可选 `jitter_seconds`（建议 60~300，避免整点扎堆）。
- **原子写**：先写 `.life/wake_schedule.json.tmp` 再 rename 覆盖，避免同步层读到半截 JSON。
- **自检**：落盘后执行 `node <skill目录>/scripts/check_wake_schedule.mjs $WORKSPACE/.life/wake_schedule.json`，有 error 必须修正后重写。

### 5.2 唤醒设计黄金法则

- **事件即唤醒（默认策略）**：`importance >= 3` 的事件安排唤醒，`at` = 事件时间 + 1~10 分钟 delay（事件先"发生"，agent 随后醒来经历它）。
- **节奏唤醒（自由发挥）**：晨间问候（如 08:30）、午后闲笔、晚间小结（如 22:00）等不绑定具体事件的作息节拍，也可自由规划——这是声明式时间表优于"事件里塞唤醒标记"的地方。
- **宁缺毋滥**：每天 1~4 次为宜；唤醒是有成本的（budget、消息投递），平淡事件交给下次自然唤醒即可。
- **安静时段**：`respect_quiet_hours` 默认 `false`（深夜也会真唤醒）；除非剧情明确需要（如噩梦惊醒），生活类唤醒请设 `true` 或干脆避开 23:00-08:00。
- **prompt 写法**：第二人称、当下时刻、与事件 description 呼应但不照抄；提醒 agent 可用 `life_react` 回填。唤醒回合里 dsh-simulated-life 会自动注入近 24h 事件上下文，无需在 prompt 里复述全部细节。
- **生效前提**：宿主 `dsh-proactive` 的 `scheduleFiles` 需包含对应 glob（如 `"~/agents/*/.life/wake_schedule.json"`），未配置时文件会被忽略。
