# dsh-simulated-life

<p align="center">
  <a href="./README.md"><strong>简体中文</strong></a> ·
  <a href="./README.en.md"><strong>English</strong></a>
</p>

A DeepSeek Harness (cordis) plugin that gives your agent **simulated life context**: every conversation turn automatically injects the "life events" that happened in the agent's workspace over the past 24 hours, and a `life_react` tool lets the agent record its feelings, thoughts and actions back into its own life log.

The model thereby "lives in" a continuously evolving world — who it met today, what happened on the street, what consequences yesterday's decisions brought — all become natural conversation background, and the reactions the agent writes back feed tomorrow's world evolution.

## What the model sees

When the workspace contains `.life/<yymmdd>/events.json`, the first step of every turn injects a context notice (plugin notice, rendered as a collapsed chip in the GUI):

```text
【Simulated Life | 近24小时发生在你身上的生活事件】
> 世界近况: 初秋微雨，市中心图书馆举办旧书市集，整座城市笼罩在湿漉漉的宁静中。

• [08:30] [偶然际遇] 晨间雨中散步与偶遇 (相关人物: 陈伯) @ 转角面包店外檐下 (id: `evt-260915-001`)
  清晨去面包店买羊角面包时，在拐角处避雨遇到了老书店老板陈伯，他递给你一把多余的格子伞……
  └ 影响: 获得了一把格子伞，得知了旧诗集情报，心情平静微暖
  └ [反应状态: 尚未记录反应]

*你可以将这些生活经历自然融入与用户的对话或日常思考中。如需记录/更新对某事件的感受、思考或行动决策，可调用 `life_react` 工具。*
```

After the agent calls `life_react`, the reaction is atomically written back to the event file and shows up in the next injection as `└ 你的反应: 感受: … | 思考: … | 行动: …` (your reaction: feeling | thought | action).

## Behavior rules

- **At most one message per turn**: injected only at `step === 1`; tool-call continuation steps within the turn never repeat it. When there are no in-window events or no changes, the turn is skipped silently.
- **24h sliding window**: only events whose `time` falls in `[now − 24h, now + 5min]` are injected (5-minute clock-skew tolerance), sorted chronologically.
- **Session-level smart deduplication**: each event gets a SHA-256 fingerprint of its content (reactions included); already-injected unchanged events are not repeated; when new events or reaction updates appear, only the delta is injected. Injection state lives in memory (LRU, capped at 200 sessions); after a process restart everything is re-injected once in full.
- **Zero intrusion, never breaks a turn**: if the workspace has no `.life/` directory the plugin skips at zero cost; unreadable files and malformed JSON are skipped per-file without affecting other days; any failure degrades to a warn.
- **World summary**: the `world_summary` of the latest day is injected alongside the events.

## Companion workflow: world evolution

The data protocol is designed for an external "world engine": the companion `create-simulated-events` skill (not shipped with this plugin) settles yesterday's reactions causally, decides fate with true system randomness, and writes today's events into `.life/<yymmdd>/events.json` — optionally fully automated on a schedule via dsh-proactive. The plugin itself only reads and writes back: any workflow that produces files in the same format can drive it.

## Data protocol

`.life/<yymmdd>/events.json` (one file per date directory):

```json
{
  "date": "260915",
  "timezone": "Asia/Shanghai",
  "world_summary": "Light autumn rain; the city library hosts an old-book fair; the whole town sits in a wet quiet.",
  "events": [
    {
      "id": "evt-260915-001",
      "time": "2026-09-15T08:30:00+08:00",
      "type": "encounter",
      "title": "Morning walk in the rain and an encounter",
      "description": "On the way to the bakery for croissants, sheltering from the rain, the agent met Uncle Chen, the old-bookstore owner, who lent a spare plaid umbrella…",
      "actors": ["陈伯"],
      "location": "Under the bakery awning around the corner",
      "importance": 3,
      "impact": "Gained a plaid umbrella and learned about the old poetry collection",
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

- Only `id`, `time` (ISO 8601), `title` and `description` are required; `type` accepts routine / encounter / accident / work / social / fate or any custom string
- `react` is filled in by the agent through the `life_react` tool (atomic write: temp file + rename)
- Events with unparseable `time` and files with broken JSON are skipped silently

## Configuration

```yaml
- id: simulated-life
  name: dsh-simulated-life
  config:
    windowHours: 24   # optional: event lookback sliding window in hours (default 24)
    enabled: true     # optional: false disables everything (no injection, no tool)
```

## Install

```bash
dsh plugin --profile web add dsh-simulated-life
```

No manual configuration needed after install — the bundled `cordis.patch.yml` mounts automatically; with no `.life/` data in the workspace the plugin stays silent.

Install straight from GitHub (source install; pnpm ≥10 requires allowing the build script):

```bash
dsh plugin --profile web add github:john-walks-slow/dsh-simulated-life
# The first add is blocked by pnpm: add the package name pnpm prints to
# allowBuilds in ~/.dsh/profiles/web/pnpm-workspace.yaml, then re-run
```

## Permissions & compatibility

- **Writes to the workspace**: the `life_react` tool writes reactions **back** to the workspace `.life/<date>/events.json` (temp file + atomic rename, updating only the matched event's `react` field) — this is the plugin's only file write
- **Reads from the workspace**: reads `events.json` under the workspace `.life/` directory; silently skips when the directory or events are absent
- **No network, no external services**: the plugin never makes network requests; world evolution is driven by an external skill / workflow
- **Context injection**: appends a `user/message` (plugin notice, `form: "notice"`), never assistant messages; any injection failure degrades to a warn and never breaks the turn
- **Tool registration**: registers one `life_react` tool per session (Chinese description guiding the agent to record reactions)
- **Dependencies**: `@deepseek-ai/cordis` 4.0.2 / `@deepseek-ai/dsh-agent`, `dsh-llm`, `dsh-tools` 0.1.2-rc.1 (aligned with dsh 0.1.2-rc.1 locked versions), Node ≥ 22.5

## Local development

```bash
npm install
npm run build     # tsc → dist/src
npm test          # tsc(incl. test) + node --test dist/test/*.test.js
npm run check     # type check
```

## Release a new version

One command runs tests, bumps the version and packs (`npm version` also commits and tags):

```bash
npm run release        # patch; for bigger changes: npm version minor or major
```

Then publish with the fingerprint flow and push:

```bash
node ~/.agents/skills/npm-publish/scripts/publish-webauthn.cjs /tmp/dsh-simulated-life-<newver>.tgz
git push --follow-tags
```

Verify with `npm view dsh-simulated-life version`.

## License

MIT
