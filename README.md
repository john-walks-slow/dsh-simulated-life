# dsh-simulated-life

<p align="center">
  <a href="./README.md"><strong>简体中文</strong></a> ·
  <a href="./README.en.md"><strong>English</strong></a>
</p>

为 DeepSeek Harness（cordis plugin）的 Agent 提供**拟真生活上下文**：每轮对话自动注入工作区近 24 小时发生的"生活事件"，并提供 `life_react` 工具让 Agent 把感受、思考与行动回填到自己的生活日志。

模型由此"生活在"一个持续演化的世界里——今天遇到过谁、发生了什么插曲、之前的决定带来了什么影响，都成为对话的自然背景；而 Agent 写回的反应，又能反哺明天的世界演化。

## 模型看到什么

工作区存在 `.life/<yymmdd>/events.json` 时，每个 turn 的第一个 step 注入一条上下文通知（plugin notice，GUI 中渲染为折叠 chip）：

```text
【Simulated Life | 近24小时发生在你身上的生活事件】
> 世界近况: 初秋微雨，市中心图书馆举办旧书市集，整座城市笼罩在湿漉漉的宁静中。

• [08:30] [偶然际遇] 晨间雨中散步与偶遇 (相关人物: 陈伯) @ 转角面包店外檐下 (id: `evt-260915-001`)
  清晨去面包店买羊角面包时，在拐角处避雨遇到了老书店老板陈伯，他递给你一把多余的格子伞……
  └ 影响: 获得了一把格子伞，得知了旧诗集情报，心情平静微暖
  └ [反应状态: 尚未记录反应]

*你可以将这些生活经历自然融入与用户的对话或日常思考中。如需记录/更新对某事件的感受、思考或行动决策，可调用 `life_react` 工具。*
```

Agent 调用 `life_react` 后，反应原子写回事件文件，下一轮注入时显示为 `└ 你的反应: 感受: … | 思考: … | 行动: …`。

## 行为规则

- **每 turn 至多一条**：仅 `step === 1` 注入；turn 内工具调用续步不重复。无窗口内事件、无变化时本轮静默跳过。
- **24h 滑动窗口**：只注入 `time` 落在 `[now − 24h, now + 5min]` 内的事件（容忍 5 分钟时钟偏差），按时间升序排列。
- **会话内智能去重**：每条事件按内容（含反应）计算 SHA-256 指纹；已注入且无变化不再重复；有新事件或反应更新时只注入增量。注入状态存于内存（LRU，上限 200 个会话），进程重启后重新全量注入一次。
- **零侵入、绝不打断 turn**：工作区没有 `.life/` 目录时零开销静默跳过；读取失败、JSON 损坏的文件逐个跳过不影响其他日期；任何异常捕获降级为 warn。
- **世界近况**：取日期最新的 `world_summary` 一并注入。

## 配套工作流：世界演化

数据协议为外部"世界引擎"设计：本仓库的姊妹工作流 `create-simulated-events` Skill（未随插件分发）每日读取昨日反应做因果结算、以系统真随机投骰判定命运、生成今日事件写入 `.life/<yymmdd>/events.json`，并可配合 dsh-proactive 定时全自动运行。插件本体只负责读取与回填——任何按同一格式写文件的流程都能驱动它。

## 数据协议

`.life/<yymmdd>/events.json`（每个日期目录一个文件）：

```json
{
  "date": "260915",
  "timezone": "Asia/Shanghai",
  "world_summary": "初秋微雨，市中心图书馆举办旧书市集，整座城市笼罩在湿漉漉的宁静中。",
  "events": [
    {
      "id": "evt-260915-001",
      "time": "2026-09-15T08:30:00+08:00",
      "type": "encounter",
      "title": "晨间雨中散步与偶遇",
      "description": "清晨去面包店买羊角面包时，在拐角处避雨遇到了老书店老板陈伯……",
      "actors": ["陈伯"],
      "location": "转角面包店外檐下",
      "importance": 3,
      "impact": "获得了一把格子伞，得知了旧诗集情报",
      "react": {
        "feeling": "感到意外而温暖",
        "thought": "旧诗集很可能是绝版初版，下午有空去看看",
        "action": "向陈伯道谢并借了伞，决定下午前往集市",
        "updated_at": "2026-09-15T14:20:00+08:00"
      }
    }
  ]
}
```

- 必需字段只有 `id`、`time`（ISO 8601）、`title`、`description`；`type` 支持 routine / encounter / accident / work / social / fate 或自定义字符串
- `react` 由 Agent 通过 `life_react` 工具回填（临时文件 + rename 原子写入）
- `time` 无法解析、JSON 损坏的事件或文件会被静默跳过

## 配置

```yaml
- id: simulated-life
  name: dsh-simulated-life
  config:
    windowHours: 24   # 可选：事件回溯滑动窗口时长（小时，默认 24）
    enabled: true     # 可选：false 时完全停用（不注入、不注册工具）
```

## 安装

```bash
dsh plugin --profile web add dsh-simulated-life
```

安装后无需手动改配置，插件自带的 `cordis.patch.yml` 自动挂载生效；工作区没有 `.life/` 数据时插件静默不动作。

从 GitHub 直装（源码安装，pnpm ≥10 需允许构建脚本）：

```bash
dsh plugin --profile web add github:john-walks-slow/dsh-simulated-life
# 首次 add 会被 pnpm 拦截：把 pnpm 提示的包名加入
# ~/.dsh/profiles/web/pnpm-workspace.yaml 的 allowBuilds 后重跑
```

## 权限与兼容

- **写工作区**：`life_react` 工具会把反应**写回**工作区 `.life/<日期>/events.json`（临时文件 + 原子 rename，只更新对应事件的 `react` 字段）——这是本插件唯一的文件写入行为
- **读工作区**：读取工作区 `.life/` 目录下的 `events.json`；无目录、无事件时静默跳过
- **无网络、无外部服务**：不发起任何网络请求；世界演化由外部 Skill / 工作流驱动
- **上下文注入**：以 `user/message`（plugin notice，`form: "notice"`）追加，绝不注入 assistant 消息；注入失败降级为 warn，绝不打断 turn
- **工具注册**：安装后向会话注册一个 `life_react` 工具（描述为中文，引导 Agent 回填反应）
- **依赖**：`@deepseek-ai/cordis` 4.0.2 / `@deepseek-ai/dsh-agent`、`dsh-llm`、`dsh-tools` 0.1.2-rc.1（与 dsh 0.1.2-rc.1 锁定版本对齐），Node ≥ 22.5

## 本地开发

```bash
npm install
npm run build     # tsc → dist/src
npm test          # tsc(含 test) + node --test dist/test/*.test.js
npm run check     # 类型检查
```

## 发新版

改动入库后一条命令完成测试、版本号、打包（`npm version` 会自动 commit 并打 tag）：

```bash
npm run release        # patch；较大更新改用：npm version minor 或 major
```

然后指纹发布并推送：

```bash
node ~/.agents/skills/npm-publish/scripts/publish-webauthn.cjs /tmp/dsh-simulated-life-<新版>.tgz
git push --follow-tags
```

发布后 `npm view dsh-simulated-life version` 复验。

## License

MIT
