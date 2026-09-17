# dsh-simulated-life

DeepSeek Harness 插件：为 Agent 提供拟真生活上下文感知与生活反应沉淀。

## 功能特性

1. **自动 24 小时生活事件注入**：在每个对话回合首个 step 自动扫描工作区 `.life/<yymmdd>/events.json`，过滤过去 24 小时内发生的拟真事件并注入上下文。
2. **智能增量去重**：会话内记录已注入事件指纹，无新事件/无反应更新时静默跳过，避免膨胀上下文。
3. **交互工具 `life_react`**：允许 Agent 主动沉淀对某生活事件的情绪（feeling）、内心思考（thought）和行动（action）。
4. **配套 Skill `create-simulated-events`**：提供世界演算、真随机命运判定与昨日反应结算闭环。

## 安装

```bash
dsh plugin --profile web add github:john-walks-slow/dsh-simulated-life
```

安装后无需手动修改配置，插件自带 `cordis.patch.yml` 会自动挂载生效。

## 架构与数据协议

事件数据存储在各工作区下的 `.life/<yymmdd>/events.json`：

```json
[
  {
    "id": "evt-260915-001",
    "time": "2026-09-15T08:30:00+08:00",
    "title": "早市偶遇陈伯",
    "description": "在晨间早市遇到了旧书摊的陈伯，闲聊中得知他刚进了一批老县志和旧诗集。",
    "tags": ["社交", "市井", "偶遇"],
    "actors": ["陈伯"],
    "react": {
      "feeling": "感到意外而温暖",
      "thought": "旧诗集很可能是绝版初版，下午有空去看看",
      "action": "向陈伯道谢并借了伞，决定下午前往集市",
      "updatedAt": "2026-09-15T14:20:00+08:00"
    }
  }
]
```

## License

MIT
