import test from "node:test";
import assert from "node:assert/strict";
import { formatSingleEvent, formatLifeContext, formatNoticeSummary } from "../src/formatter.js";
test("formatSingleEvent outputs clean markdown with tags, actors, and react", () => {
    const loaded = {
        event: {
            id: "evt-01",
            time: "2026-09-15T08:30:00+08:00",
            type: "encounter",
            title: "遇到陈伯",
            description: "在面包店避雨时遇到老书店老板陈伯。",
            actors: ["陈伯"],
            location: "转角面包店",
            impact: "获得一把雨伞",
            react: {
                feeling: "温暖",
                thought: "下午可以去集市看看",
                action: "向陈伯道谢"
            }
        },
        dayDate: "260915",
        filePath: "/fake/path/events.json",
        epochMs: 1789459200000
    };
    const formatted = formatSingleEvent(loaded);
    assert.ok(formatted.includes("• [08:30] [偶然际遇] 遇到陈伯 (相关人物: 陈伯) @ 转角面包店 (id: `evt-01`)"));
    assert.ok(formatted.includes("在面包店避雨时遇到老书店老板陈伯。"));
    assert.ok(formatted.includes("影响: 获得一把雨伞"));
    assert.ok(formatted.includes("你的反应: 感受: 温暖 | 思考: 下午可以去集市看看 | 行动: 向陈伯道谢"));
});
test("formatLifeContext builds full context with world summary and guidance", () => {
    const loaded = {
        event: {
            id: "evt-02",
            time: "2026-09-15T14:00:00+08:00",
            title: "旧书集市",
            description: "在集市淘到心仪诗集。"
        },
        dayDate: "260915",
        filePath: "/fake/path/events.json",
        epochMs: 1789479000000
    };
    const output = formatLifeContext([loaded], "初秋微雨，城市宁静", false);
    assert.ok(output.includes("【Simulated Life | 近24小时发生在你身上的生活事件】"));
    assert.ok(output.includes("> 世界近况: 初秋微雨，城市宁静"));
    assert.ok(output.includes("旧书集市"));
    assert.ok(output.includes("life_react"));
    const summary = formatNoticeSummary(3, false);
    assert.equal(summary, "载入了近24小时内 3 条生活事件");
});
