# 检视报告

## 概要

对 `dsh-simulated-life` 插件及其配套 `create-simulated-events` Skill 进行了全面检视，涵盖类型定义、加载器、去重引擎、格式化器、`life_react` 工具、插件入口、单元测试与 Skill 文档。整体架构清晰、模块边界合理、错误处理一致、与 DSH 平台契约对齐良好，工具定义格式与现有 DSH 内置工具一致。存在若干计划偏离与内存管理隐患，但不影响核心功能运行。

## 需求对齐

插件核心功能——24h 滑动窗口事件加载、会话内增量去重、notice 形式上下文注入、`life_react` 工具原子落盘——均已实现且与计划 §4 一致。Skill 文档覆盖了计划 §5 中世界演算、真随机命运、前日结算与 proactive 集成的全部要点。

**计划偏离（3 处）**：

1. **`ctx.sessionProjections` 未使用**（计划 §4.1 第 4 点）：计划明确要求"利用 `ctx.sessionProjections` 记录当前会话已注入的 `eventId` 与对应 `hash(event)`"，实现改为 `apply` 闭包内的本地 `Map<string, SessionLifeProjectionState>`。功能等价（会话内去重），但不走 DSH canonical 的 session 投影机制，且缺少 session 结束时的状态清理。若为有意简化，建议在文档中记录决策理由。

2. **`scripts/dice.mjs` 缺失**（计划 Phase 4）：计划要求"配备真随机命运骰子辅助脚本 `scripts/dice.mjs`"，实际 Skill 目录仅有 `SKILL.md`，骰子逻辑以内联 `node -e` 命令形式嵌入 SKILL.md。功能等价但缺少独立可复用的脚本文件。

3. **`world_state.json` 未实现**（计划 §3.1）：计划描述了 `.life/world_state.json` 作为"当前 Agent 所处世界/城市的基本状态缓存"，插件运行时与 Skill 均未实现对此文件的读写。Skill 文档中提及读取 `world_state.json` 但未提供写入逻辑。当前为 Skill 侧的规范留白，不阻塞插件准入。

## 阻塞问题

无。

## 建议修改

| ID  | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| S1 | `src/formatter.ts:10-20` | `formatTimeOnly` 使用 `new Date(isoStr).getHours()`，返回运行时本地时区的小时数，而非事件自身的时区。当前容器时区为 `Asia/Shanghai` 可正确显示，但插件部署到 UTC 服务器时（如云主机），`08:30+08:00` 的事件会显示为 `00:30`。 | 使用 `Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone })` 或从 ISO 字符串解析时区偏移手动计算，确保显示时间与事件时区一致。 |
| S2 | `src/index.ts:104` | `sessionMemoryStates` Map 随 session 创建不断增长，无清理机制。DSH 长期运行（数周、数百 session）后会持续积累内存。 | 注册 session 生命周期清理（如监听 session end 事件删除对应 entry），或在每次 pre-step 时淘汰超过 N 小时未活跃的 session 状态。 |
| S3 | `src/deduplication.ts:56` | `evaluateDeduplication` 构造 `nextInjectedRecords` 时以 `{ ...previousInjected }` 展开旧状态，不清理已滑出 24h 窗口的事件记录。长会话中 `injectedEvents` 无界增长。 | 在遍历 `loadedEvents` 后，将 `nextInjectedRecords` 过滤为仅包含当前 `loadedEvents` 中存在的 eventId，淘汰窗口外陈旧记录。 |
| S4 | `src/tools/life-react.ts:31-86` | `findEventInWorkspace` 即使已找到目标事件仍继续扫描所有目录，仅为收集 `allEventSummaries`（仅 `!found` 时使用）。事件积累数月后，成功路径的 I/O 开销不必要。 | 找到事件后 `break` 外层循环；仅在未找到时执行全量扫描收集摘要列表。或分离 `findEvent` 和 `listAllEvents` 两个函数。 |
| S5 | `package.json:46` | `@deepseek-ai/dsh-session` 声明为 dependency，但 src 和 test 中均无 import。属于多余依赖。 | 从 `dependencies` 中移除 `@deepseek-ai/dsh-session`。 |
| S6 | 计划 vs 实现 | 计划 §4.1 要求使用 `ctx.sessionProjections`，实现改用本地 Map。虽功能等价，但偏离了 DSH canonical 的 session 状态管理机制，且缺少文档说明。 | 若有意简化，在 AGENTS.md 或计划文档补充决策记录；若应回归计划，改用 `ctx.sessionProjections` 的 `get`/`set` 接口存储 `SessionLifeProjectionState`。 |

## 非阻塞问题

| ID  | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| N1 | `src/index.ts:101` | `(ctx as any).tools.register(...)` 使用 `as any` 绕过类型检查。`tools` 已在 inject 数组中声明，理论上可直接访问。 | 若 cordis Context 类型未扩展 DSH 服务属性，考虑声明局部 interface 或使用 `ctx.tools`（依赖 cordis 的 declaration merging）；保持现状也可，但 `as any` 是坏味道。 |
| N2 | `src/index.ts:91` | `apply` 的 config 参数类型为 `{ windowHours?: number; enabled?: boolean }`（可选），但 `Config` Schemastery schema 使用 `.default()`，运行时 config 必然包含这两个字段。类型与实际不符。 | 将参数类型改为 `{ windowHours: number; enabled: boolean }` 或直接使用 `Config` 的推断类型。 |
| N3 | `src/tools/life-react.ts:40` | `readdir(lifeDir)` 未包裹 try-catch，与 `loader.ts:55-58` 的容错风格不一致。`isDirectory` 检查通过后 `readdir` 仍可能因权限问题抛出。 | 加 try-catch 返回 `{ allEventSummaries: [] }`，与 loader 保持一致的容错策略。 |
| N4 | `src/formatter.ts:11-19` | `formatTimeOnly` 的 `try-catch` 为死代码——`new Date()` 不抛异常（返回 Invalid Date），`getHours()` 对 Invalid Date 返回 NaN 而非抛出。已有 `Number.isNaN(d.getTime())` 前置检查。 | 移除不必要的 try-catch。 |
| N5 | 项目根目录 | `package.json` 的 `files` 数组引用了 `README.md` 和 `LICENSE`，但两者均不存在。 | 发布前补建这两个文件。 |
| N6 | `test/` | 测试覆盖缺口：(a) index.ts 的 isDelta=true 增量注入路径；(b) index.ts 的 dedup no-op 跳过路径；(c) deduplication 的 `forceFull` 参数；(d) life-react 的部分更新（仅 feeling 无 thought/action）；(e) loader 对事件缺少 id/title 字段的过滤。 | 在后续迭代中补充上述场景测试。 |
| N7 | `src/loader.ts:94` | `worldSummary` 选择使用 `entry >= latestDayDate` 字符串比较目录名。对 `yymmdd` 格式同世纪内有效，但对非日期目录名或跨世纪边界会出错。 | 可选：用正则校验目录名是否为 6 位数字后再参与比较，或直接以 `events.json` 中 `dayData.date` 字段排序。 |
| N8 | `src/types.ts:5-12` | `EventType` 使用 `(string & {})` 模式允许任意字符串扩展，但 `category` 字段无枚举约束。计划 §3.2 中 `type` 有明确枚举但 `category` 无。 | 若 `category` 也需规范，补充枚举；若保持开放，当前实现合理。 |

## 准入结论

**结论**：`条件准入`

**说明**：无阻塞问题，插件核心功能完整、架构清晰、与 DSH 平台契约对齐。存在 6 项建议修改（时区显示可移植性、内存管理、计划偏离与多余依赖），建议在合并前或后续迭代中处理。其中 S1（时区）与 S2/S3（内存管理）优先级较高，建议在接入线上 profile 前完成。
