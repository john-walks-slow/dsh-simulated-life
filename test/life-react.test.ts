import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createLifeReactTool } from "../src/tools/life-react.js";

test("life_react tool writes reaction to matching events.json and updates timestamp", async () => {
	const tempDir = await mkdtemp(join(tmpdir(), "life-react-test-"));
	try {
		const lifeDir = join(tempDir, ".life");
		const dayDir = join(lifeDir, "260915");
		await mkdir(dayDir, { recursive: true });

		const initialData = {
			date: "260915",
			events: [
				{
					id: "evt-test-1",
					time: "2026-09-15T08:30:00+08:00",
					title: "Morning walk",
					description: "Walk in rain"
				}
			]
		};
		await writeFile(join(dayDir, "events.json"), JSON.stringify(initialData, null, 2), "utf8");

		const tool = createLifeReactTool();
		const fakeExec: any = {
			rootCallId: "root-1",
			token: "token-1",
			callId: "call-1",
			name: "life_react",
			arguments: {},
			agent: {
				session: {
					header: {
						cwd: tempDir
					}
				}
			},
			signal: new AbortController().signal,
			deferContext: () => {},
			concludeTurn: () => {}
		};

		const result: any = await tool.execute(
			{
				eventId: "evt-test-1",
				feeling: "感到温暖",
				action: "向陈伯道谢"
			},
			fakeExec
		);

		assert.equal(result.success, true);
		assert.equal(result.eventId, "evt-test-1");

		// Verify file was updated on disk
		const rawUpdated = await readFile(join(dayDir, "events.json"), "utf8");
		const parsed = JSON.parse(rawUpdated);
		assert.equal(parsed.events[0].react.feeling, "感到温暖");
		assert.equal(parsed.events[0].react.action, "向陈伯道谢");
		assert.ok(typeof parsed.events[0].react.updated_at === "string");
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
});

test("life_react tool provides helpful error with available event list when event is missing", async () => {
	const tempDir = await mkdtemp(join(tmpdir(), "life-react-test-"));
	try {
		const lifeDir = join(tempDir, ".life");
		const dayDir = join(lifeDir, "260915");
		await mkdir(dayDir, { recursive: true });

		await writeFile(
			join(dayDir, "events.json"),
			JSON.stringify({
				date: "260915",
				events: [{ id: "evt-real-1", title: "Real event" }]
			}),
			"utf8"
		);

		const tool = createLifeReactTool();
		const fakeExec: any = {
			rootCallId: "root-2",
			token: "token-2",
			callId: "call-2",
			name: "life_react",
			arguments: {},
			agent: {
				session: {
					header: {
						cwd: tempDir
					}
				}
			},
			signal: new AbortController().signal,
			deferContext: () => {},
			concludeTurn: () => {}
		};

		await assert.rejects(
			async () => {
				await tool.execute({ eventId: "evt-non-existent", feeling: "sad" }, fakeExec);
			},
			(err: Error) => {
				assert.ok(err.message.includes('未找到 ID 为 "evt-non-existent" 的生活事件'));
				assert.ok(err.message.includes("[evt-real-1] Real event"));
				return true;
			}
		);
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
});
