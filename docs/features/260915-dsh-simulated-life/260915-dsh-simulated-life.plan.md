# dsh-simulated-life 架构设计与实现计划

## 1. 概述与背景

`dsh-simulated-life` 是为 DeepSeek Harness（DSH）设计的「数字生命生活模拟与世界演化」插件生态。
它旨在打破 AI Agent 仅作为被动工具/代码助手的局限，赋予 Agent 真实、持续、有沉浸感的生活轨迹与世界感知：
- **Agent 端（感知与生活沉浸）**：每个回合感知自身工作区过去 24 小时内发生的真实拟真生活事件（日常生活、人际交往、意外变故、环境变化），并支持 Agent 主动沉淀对事件的情感、思考与行动反应（`react`）。
- **世界端（演算世界与命运之神）**：附带独立的高级 Skill `create-simulated-events`，作为世界引擎（Game Master / World Engine），跟踪宏观世界与多 Agent 状态，借助系统真随机（True Random）判定命运走向，进行每日因果结算并生成逼真、有温度的日常事件，可配合 `proactive` 插件实现全自主每日定时演化。

---

## 2. 整体架构与模块划分

系统分为两大核心层级：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DSH Plugin Ecosystem                             │
├─────────────────────────────────────────┬───────────────────────────────────┤
│    dsh-simulated-life (Runtime Core)    │ create-simulated-events (Skill)   │
│                                         │                                   │
│  1. Session Context Injection           │ 1. World State & Environment      │
│     - agent/pre-step hook (step === 1)  │    Tracking                       │
│     - Read $cwd/.life/yymmdd/events.json│ 2. Living Agents State Roster     │
│     - 24h Sliding Window Filter         │ 3. Daily Settlement & React       │
│     - Intelligent Deduplication         │    Repercussions                  │
│     - Zero-overhead silent skip         │ 4. True Random Fate Engine        │
│                                         │    (System Entropy / Dice Roll)   │
│  2. Interactive Tool: life_react        │ 5. Simulated Events Generation &  │
│     - Fill/Update feeling, thought,     │    Persistence (.life/yymmdd/)    │
│       action into events.json           │ 6. Proactive Daily Cron Autonomy  │
└─────────────────────────────────────────┴───────────────────────────────────┘
```

---

## 3. 数据结构规范

### 3.1 目录层级
每个 Living Agent 的工作目录（例如 `Living Agent 工作区/` 或测试工作区）下维护私有 `.life/` 目录：
```text
$WORKSPACE/.life/
├── world_state.json         # (可选) 当前 Agent 所处世界/城市的基本状态缓存
├── 260914/
│   └── events.json          # 2026-09-14 的所有事件与已回填反应
└── 260915/
    └── events.json          # 2026-09-15 (今日) 的所有事件与反应
```

### 3.2 `events.json` 格式定义
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "version": 1,
  "date": "260915",
  "timezone": "Asia/Shanghai",
  "world_summary": "初秋微雨，市中心图书馆举办旧书市集，整座城市笼罩在湿漉漉的宁静中。",
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
      "react": {
        "feeling": "感到意外而温暖",
        "thought": "很久没去陈伯的书店了，下午有空或许可以去市集淘淘那本诗集",
        "action": "向陈伯道谢并约定下午去市集看看",
        "updated_at": "2026-09-15T10:15:00+08:00"
      }
    }
  ]
}
```

- **`type` 枚举**：
  - `routine`：日常生活起居、通勤、做饭、散步等
  - `encounter`：偶然相遇、结识新朋友或遇到熟人
  - `accident`：突发事件、意外变故、小插曲（如下雨忘带伞、偶遇流浪猫）
  - `work`：工作/研究相关的进展、挑战或反馈
  - `social`：社交聚会、约定、通信、聊天
  - `fate`：命运关键事件、重大契机、人生转折点
- **`importance` (1-5)**：
  - 1: 琐碎小事
  - 2: 日常插曲
  - 3: 值得关注的事件
  - 4: 产生显著情绪或状态影响的重大事件
  - 5: 改变生活轨迹或世界线的大事件
- **`react` 字段**：
  - 由世界引擎生成时可为 `null`；
  - Agent 在自身交互或调用 `life_react` 工具时回填，包含 `feeling`、`thought`、`action`、`updated_at`。

---

## 4. 插件运行时设计 (`dsh-simulated-life`)

### 4.1 上下文注入机制 (`agent/pre-step`)
1. **触发契机**：
   - 监听 `agent/pre-step` 事件，在 `step === 1`（每一轮开始）且 `decision.kind === "enter"` 时介入。
2. **工作区检测与无侵入跳过**：
   - 提取 `agent.session.header.cwd`。
   - 检查 `$cwd/.life` 是否存在。若不存在，直接 `return decision`，零性能开销、零干扰。
3. **24 小时动态滑动窗口过滤**：
   - 采样当前时间 `now = Date.now()`。
   - 计算时间窗口 `[now - 24 * 3600 * 1000, now]`。
   - 遍历 `.life/` 目录下相关日期的 `events.json`，筛选所有 `event.time` 落在该 24 小时窗口内的事件。
4. **智能去重策略 (Session Projections)**：
   - 利用 `ctx.sessionProjections` 记录当前会话已注入的 `eventId` 与对应 `hash(event)`。
   - 若所有处于 24h 窗口内的事件均已完整注入且无新 `react` 变更，则本轮跳过重复注入，避免膨胀上下文。
   - 若有新发生事件或更新了 `react`，则只注入增量变动或最新 24 小时生活快照。
5. **注入格式 (DSH 合规契约)**：
   - 构造 `UserMessage`：
     ```ts
     createUserMessage({
       content: [{ type: "text", text: renderedLifeContext }],
       source: {
         kind: "plugin",
         plugin: "dsh-simulated-life",
         form: "notice",
         summary: boundContextSummary(summaryText)
       }
     })
     ```
   - 坚决遵守 DSH 插件平台契约：不注入 `assistant/message`，不破坏 step 窗口。

### 4.2 专属互动工具 `life_react`
- **Tool 注册**：`life_react`
- **输入参数**：
  - `eventId`: 必须，目标事件的唯一标识（如 `"evt-260915-001"`）
  - `feeling`: 可选，面对此事件的情感/感受
  - `thought`: 可选，对事件的思考/内心想法
  - `action`: 可选，采取的实际行动或后续决策
- **执行逻辑**：
  - 定位工作区 `.life/` 下包含该 `eventId` 的 `events.json` 文件；
  - 原子性更新该事件的 `react` 对象，并打上 `updated_at: new Date().toISOString()`；
  - 返回确认信息，供 Agent 在对话中自然延续生活反应。

---

## 5. 世界演算与生活模拟 Skill (`create-simulated-events`)

### 5.1 核心定位与工作流
作为演化世界与生活的 GM（Game Master），执行完整的 **Daily Simulation Loop**：

```
[1. 读取世界与多Agent状态] 
         │
         ▼
[2. 结算前日 React 与因果连锁] (Daily Settlement)
         │
         ▼
[3. 系统真随机命运投骰] (True Random Fate Dice: 1d100, d20)
         │
         ▼
[4. 演化世界大环境与今日宏观局势] (Weather, News, City Pulse)
         │
         ▼
[5. 为每个 Living Agent 生成今日生活事件] (.life/yymmdd/events.json)
         │
         ▼
[6. 归档演化记录与更新世界日志]
```

### 5.2 真随机命运系统（True Random Fate Engine）
- **核心原则**：严禁 LLM 脑补伪随机，必须利用操作系统高熵随机源（`/dev/urandom`、`crypto.randomInt` 或 dice 脚本）生成真实的随机数。
- **命运判定表（Fate Tables）**：
  - **日运势检定 (1d100)**：
    - 95-100【大吉 / 奇遇】：获得意外惊喜、重大机遇或罕见际遇
    - 70-94【顺遂 / 舒心】：日常平稳惬意，社交愉快，工作高效
    - 30-69【寻常 / 平淡】：标准的日常生活，细水长流
    - 10-29【波折 / 消耗】：遇到小麻烦、轻微疲劳或计划受阻
    - 1-9【厄运 / 考验】：突发重大变故、物品损坏或人际冲突
  - **事件类型权重池**：
    - 日常起居与烟火气（50%）
    - 社交与人际遭遇（25%）
    - 工作/创造/技能相关（15%）
    - 突发意外与探索（10%）

### 5.3 前日结算（Daily Settlement & React Repercussions）
- 读取昨天的事件与 Agent 填写的 `react`：
  - 若 Agent 采取了积极行动（如“去市集买诗集”），今天生成后续（“在诗集中发现旧书签”）；
  - 若 Agent 产生负面情绪（如“熬夜焦虑”），今天附加物理状态（“起床时略感头痛”）；
  - 若多个 Agent 处于同一生活圈，计算交叉影响（Agent A 在咖啡馆遗落的东西被 Agent B 捡到）。

### 5.4 与 `proactive` 定时自动化集成
- 支持配置每日凌晨（如 `cron: "0 5 * * *"`）通过 `proactive_set` 自动拉起世界演化 Agent：
  - 自主运行 `create-simulated-events` 完成全量结算与事件生成；
  - 任务完成后使用 `no_reply` 静默收尾，完全无感。

---

## 6. 实施路线图与交付计划

### Phase 1: 基础工程与类型定义
- 初始化 `本仓库根目录` 工程；
- 编写 `package.json`（对齐 `@deepseek-ai/*` 依赖并配置本地 `node_modules`）、`tsconfig.json`、`cordis.patch.yml`；
- 实现 `src/types.ts`（数据模型、JSON Schema 校验）。

### Phase 2: 核心加载器与去重引擎开发
- 实现 `src/loader.ts`：日期扫描、24h 动态滑动窗口过滤、稳健的容错机制；
- 实现 `src/deduplication.ts`：Session Projections 状态跟踪与增量变动检测；
- 实现 `src/formatter.ts`：拟真生活上下文渲染与 notice 摘要；
- 编写完整的单元测试（跨天、跨月、时区、去重、无 `.life` 目录静默回退）。

### Phase 3: 工具开发与插件组装
- 实现 `src/tools/life-react.ts`：定义 `life_react` 工具与落盘写入；
- 实现 `src/index.ts`：组装 `agent/pre-step` 监听器与工具注入；
- 编写工具与集成测试。

### Phase 4: 世界演化 Skill 开发
- 在 `~/.agents/skills/create-simulated-events/` 编写完整的 `SKILL.md`；
- 配备真随机命运骰子辅助脚本 `scripts/dice.mjs`；
- 提供世界设定与 Agent 状态的规范模板。

### Phase 5: 端到端验证与 Profile 接线
- 在真实 Agent 目录（如 `Living Agent 工作区/` 或隔离测试环境）创建模拟 `.life` 数据；
- 执行端到端会话演练（24h 注入验证、`life_react` 回填验证、增量去重验证）；
- 接入 `~/.dsh/profiles/web/package.json`并在独立端口完成 DSH 启动与加载验证。
