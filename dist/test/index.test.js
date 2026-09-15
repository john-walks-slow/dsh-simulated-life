import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleLifePreStep } from "../src/index.js";
test("handleLifePreStep respects step===1 and aborted signals", async () => {
    const fakeAgent = { session: { header: { cwd: "/tmp" } } };
    // Step !== 1
    const r1 = await handleLifePreStep(fakeAgent, 2, false, undefined, 24);
    assert.equal(r1.message, undefined);
    // Aborted
    const r2 = await handleLifePreStep(fakeAgent, 1, true, undefined, 24);
    assert.equal(r2.message, undefined);
});
test("handleLifePreStep injects notice UserMessage when events exist in .life", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "life-index-test-"));
    try {
        const lifeDir = join(tempDir, ".life");
        const dayDir = join(lifeDir, "260915");
        await mkdir(dayDir, { recursive: true });
        const now = Date.now();
        const eventTime = new Date(now - 1000 * 3600).toISOString();
        await writeFile(join(dayDir, "events.json"), JSON.stringify({
            date: "260915",
            world_summary: "A sunny autumn day",
            events: [
                {
                    id: "evt-01",
                    time: eventTime,
                    title: "Morning coffee",
                    description: "Enjoyed a warm cup of coffee."
                }
            ]
        }), "utf8");
        const fakeAgent = {
            session: {
                id: "session-1",
                header: {
                    cwd: tempDir
                }
            }
        };
        const result = await handleLifePreStep(fakeAgent, 1, false, undefined, 24, now);
        assert.ok(result.message);
        assert.equal(result.message.role, "user");
        assert.equal(result.message.source.plugin, "dsh-simulated-life");
        assert.equal(result.message.source.form, "notice");
        const contentText = result.message.content[0].text;
        assert.ok(contentText.includes("Morning coffee"));
        assert.ok(contentText.includes("A sunny autumn day"));
    }
    finally {
        await rm(tempDir, { recursive: true, force: true });
    }
});
