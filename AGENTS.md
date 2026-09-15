# dsh-simulated-life AGENTS.md

## 目标

dsh 插件（DeepSeek Harness / cordis plugin）：为 Agent 提供拟真生活上下文（`.life/<yymmdd>/events.json`）感知与生活反应沉淀能力。
1. 每回合在第一个 step 自动注入过去 24 小时内的生活事件，并支持会话内智能增量去重；
2. 提供 `life_react` 工具，供 Agent 主动回填对事件的感受（feeling）、思考（thought）与行动决策（action）；
3. 配合 `create-simulated-events` Skill，实现真随机命运投骰、多 Agent 生活轨迹演化与前日结算闭环。

## 地图

- `src/types.ts` — 核心数据模型与类型（SimulatedEvent, EventReaction, LifeDayData, PluginConfig 等）
- `src/loader.ts` — 24h 滑动窗口事件加载器、目录扫描与容错处理
- `src/deduplication.ts` — Session 级别已注入事件状态跟踪与增量变动检测
- `src/formatter.ts` — 拟真生活上下文渲染与 notice 摘要格式化
- `src/tools/life-react.ts` — `life_react` 互动工具定义与原子持久化写入
- `src/index.ts` — 插件入口（`Config`、`apply`、`inject`、`agent/pre-step` 监听与 tool 注册）
- `test/` — 单元测试（24h 跨天过滤、去重算法、格式化渲染、工具执行）
- `cordis.patch.yml` — loader bundle 注册层（id: simulated-life）

## 开发与调试

```bash
npm install && npm run build   # tsc → dist/src
npm test                       # 完整单元测试（tsc 含 test + node --test）
npm run check                  # 类型检查
```

## 规范与避坑

1. **依赖纪律**：所有运行时 `import` 的 `@deepseek-ai/*` 与外部包必须在 `package.json` 的 `dependencies` 声明并在本地 `npm install` 拥有 `node_modules`。
2. **inject 数组必须写全**：直接访问的所有 cordis 服务（`["agents", "tools"]` 等）必须完整声明在 `inject` 数组中。
3. **注入契约**：消息必须是 `user/message` + `source: { kind: "plugin", plugin: "dsh-simulated-life", form: "notice", summary }`，绝不注入 `assistant/message`。
4. **零侵入与不打断 turn**：若工作区无 `.life/` 目录则静默跳过；加载或执行异常一律捕获降级，绝不打断正常会话。
