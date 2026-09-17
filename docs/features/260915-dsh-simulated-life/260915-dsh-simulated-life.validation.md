# dsh-simulated-life 验收与用户验证文档

## 1. 验证目标

验证 `dsh-simulated-life` 插件与 `create-simulated-events` Skill 在真实 DSH 环境下的协同表现：
1. 插件可正常被 DSH 加载，无依赖缺失与启动异常；
2. 工作区在具备 `.life/<yymmdd>/events.json` 时，首步自动注入 24 小时内的生活事件；
3. 会话在后续轮次中正确去重（无新事件时不重复注入）；
4. Agent 可通过 `life_react` 工具成功回填对事件的感受（feeling）、思考（thought）和行动（action）；
5. `create-simulated-events` Skill 及配套真随机投骰能够生成合规的今日事件。

---

## 2. 自动化验证记录

| 验证项 | 测试方法 | 预期结果 | 实际结果 | 状态 |
|---|---|---|---|---|
| **24h 滑动窗口与跨天过滤** | `loader.test.ts` | 准确过滤距当前时间 24h 内的事件，忽略超出窗口的历史事件 | 13/13 用例全部通过，跨天与时区边界正确 | PASS |
| **会话内增量去重** | `deduplication.test.ts` | 首次完整注入；同事件无变化跳过；有新事件或 react 更新只触发增量 | 准确判断首轮、去重及增量变更 | PASS |
| **Markdown 格式化** | `formatter.test.ts` | 正确渲染事件分类、时间、地点、人物、影响与反应状态 | 渲染格式规范，notice summary 正常 | PASS |
| **`life_react` 工具交互** | `life-react.test.ts` | 正确按 eventId 查找并原子更新对应 events.json，刷新 updated_at | 原子写入成功，缺失 eventId 时给出友好候选列表 | PASS |
| **Profile 与 DSH 启动加载** | 4176 端口临时实例 | `dsh web --port 4176` 顺利启动，无 ESM 缺失与 loader 异常 | 端口正常监听，服务加载稳定 | PASS |

---

## 3. 用户实机验证建议路径

用户可选择在任一 Living Agent 工作区或隔离测试工作区中进行如下验证：

1. **准备生活事件**：
   在工作区创建 `.life/260915/events.json`（可使用 `create-simulated-events` Skill 自动生成）。
2. **开启对话体验感知**：
   向该 Agent 发送消息（例如：“今天过得怎么样？”），观察 Agent 是否已自然获知清晨发生的生活插曲。
3. **测试反应回填**：
   让 Agent 调用 `life_react` 对某一事件记录它的真实心情与行动决策，检查 `.life/260915/events.json` 文件是否已原子更新。
