# dsh-simulated-life

DeepSeek Harness 插件：为 Agent 提供拟真生活上下文感知与生活反应沉淀。

## 功能特性

1. **自动 24 小时生活事件注入**：在每个对话回合首个 step 自动扫描工作区 `.life/<yymmdd>/events.json`，过滤过去 24 小时内发生的拟真事件并注入上下文。
2. **智能增量去重**：会话内记录已注入事件指纹，无新事件/无反应更新时静默跳过，避免膨胀上下文。
3. **交互工具 `life_react`**：允许 Agent 主动沉淀对某生活事件的情绪（feeling）、内心思考（thought）和行动（action）。
4. **配套 Skill `create-simulated-events`**：提供世界演算、真随机命运判定与昨日反应结算闭环。
