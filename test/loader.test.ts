import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadRecentLifeEvents, parseEventTime } from "../src/loader.js";

test("parseEventTime correctly parses valid ISO dates", () => {
	const t = parseEventTime("2026-09-15T08:30:00+08:00");
	assert.ok(!Number.isNaN(t));
	assert.ok(t > 0);

	assert.ok(Number.isNaN(parseEventTime("")));
	assert.ok(Number.isNaN(parseEventTime(null)));
	assert.ok(Number.isNaN(parseEventTime("not-a-date")));
});

test("loadRecentLifeEvents returns empty for non-existent workspace or missing .life", async () => {
	const res1 = await loadRecentLifeEvents(undefined);
	assert.deepEqual(res1.events, []);

	const tempDir = await mkdtemp(join(tmpdir(), "life-test-"));
	try {
		const res2 = await loadRecentLifeEvents(tempDir);
		assert.deepEqual(res2.events, []);
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
});

test("loadRecentLifeEvents filters events within 24h sliding window", async () => {
	const tempDir = await mkdtemp(join(tmpdir(), "life-test-"));
	try {
		const lifeDir = join(tempDir, ".life");
		const day1 = join(lifeDir, "260914");
		const day2 = join(lifeDir, "260915");
		await mkdir(day1, { recursive: true });
		await mkdir(day2, { recursive: true });

		// Baseline: 2026-09-15 12:00:00 UTC
		const now = new Date("2026-09-15T12:00:00Z").getTime();

		// Event A: 30 hours ago (should be excluded)
		const timeA = new Date(now - 30 * 3600 * 1000).toISOString();
		// Event B: 18 hours ago (should be included, from day1)
		const timeB = new Date(now - 18 * 3600 * 1000).toISOString();
		// Event C: 2 hours ago (should be included, from day2)
		const timeC = new Date(now - 2 * 3600 * 1000).toISOString();

		await writeFile(
			join(day1, "events.json"),
			JSON.stringify({
				date: "260914",
				world_summary: "Yesterday world status",
				events: [
					{ id: "evt-a", time: timeA, title: "Old event", description: "Too old" },
					{ id: "evt-b", time: timeB, title: "Yesterday evening", description: "In window" }
				]
			}),
			"utf8"
		);

		await writeFile(
			join(day2, "events.json"),
			JSON.stringify({
				date: "260915",
				world_summary: "Today world status",
				events: [
					{ id: "evt-c", time: timeC, title: "Today morning", description: "In window" }
				]
			}),
			"utf8"
		);

		const result = await loadRecentLifeEvents(tempDir, now, 24);

		assert.equal(result.events.length, 2);
		assert.equal(result.events[0].event.id, "evt-b");
		assert.equal(result.events[1].event.id, "evt-c");
		assert.equal(result.worldSummary, "Today world status");
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
});

test("loadRecentLifeEvents safely skips corrupted JSON files", async () => {
	const tempDir = await mkdtemp(join(tmpdir(), "life-test-"));
	try {
		const lifeDir = join(tempDir, ".life");
		const dayDir = join(lifeDir, "260915");
		await mkdir(dayDir, { recursive: true });

		await writeFile(join(dayDir, "events.json"), "{ invalid json syntax...", "utf8");

		const result = await loadRecentLifeEvents(tempDir, Date.now());
		assert.deepEqual(result.events, []);
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
});
