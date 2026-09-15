/**
 * Loader for .life/<yymmdd>/events.json files with 24-hour sliding window filtering.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { LifeDayData, LoadedLifeEvent, LifeEventsWindow, SimulatedEvent } from "./types.js";

const DEFAULT_WINDOW_HOURS = 24;

/**
 * Check if a directory exists safely without throwing.
 */
async function isDirectory(path: string): Promise<boolean> {
	try {
		const s = await stat(path);
		return s.isDirectory();
	} catch {
		return false;
	}
}

/**
 * Parse an ISO date or date-time string into milliseconds epoch.
 * Returns NaN if parsing fails.
 */
export function parseEventTime(timeStr: unknown): number {
	if (typeof timeStr !== "string" || !timeStr.trim()) return NaN;
	const parsed = Date.parse(timeStr);
	return Number.isNaN(parsed) ? NaN : parsed;
}

/**
 * Load and filter simulated events from $workspaceDir/.life
 *
 * @param workspaceDir - Agent's workspace root directory
 * @param now - Current epoch timestamp in milliseconds (defaults to Date.now())
 * @param windowHours - Lookback window in hours (defaults to 24)
 */
export async function loadRecentLifeEvents(
	workspaceDir: string | undefined,
	now: number = Date.now(),
	windowHours: number = DEFAULT_WINDOW_HOURS
): Promise<LifeEventsWindow> {
	if (!workspaceDir) {
		return { events: [] };
	}

	const lifeDir = join(workspaceDir, ".life");
	if (!(await isDirectory(lifeDir))) {
		return { events: [] };
	}

	let entries: string[] = [];
	try {
		entries = await readdir(lifeDir);
	} catch {
		return { events: [] };
	}

	const windowStart = now - windowHours * 3600 * 1000;
	// Allow slight clock skew up to 5 minutes into the future
	const windowEnd = now + 5 * 60 * 1000;

	const loadedEvents: LoadedLifeEvent[] = [];
	let latestWorldSummary: string | undefined;
	let latestDayDate = "";

	for (const entry of entries) {
		const dayDirPath = join(lifeDir, entry);
		if (!(await isDirectory(dayDirPath))) continue;

		const eventsFilePath = join(dayDirPath, "events.json");
		let contentStr: string;
		try {
			contentStr = await readFile(eventsFilePath, "utf8");
		} catch {
			// events.json does not exist in this subfolder or cannot be read, ignore
			continue;
		}

		let dayData: LifeDayData;
		try {
			dayData = JSON.parse(contentStr);
		} catch {
			// Malformed JSON, skip to prevent crashing
			continue;
		}

		if (!dayData || !Array.isArray(dayData.events)) {
			continue;
		}

		if (dayData.world_summary && entry >= latestDayDate) {
			latestWorldSummary = dayData.world_summary;
			latestDayDate = entry;
		}

		for (const rawEvt of dayData.events) {
			if (!rawEvt || typeof rawEvt !== "object" || !rawEvt.id || !rawEvt.title) {
				continue;
			}
			const epochMs = parseEventTime(rawEvt.time);
			if (Number.isNaN(epochMs)) continue;

			if (epochMs >= windowStart && epochMs <= windowEnd) {
				loadedEvents.push({
					event: rawEvt,
					dayDate: entry,
					filePath: eventsFilePath,
					epochMs
				});
			}
		}
	}

	// Sort events chronologically (earliest to newest)
	loadedEvents.sort((a, b) => a.epochMs - b.epochMs);

	return {
		worldSummary: latestWorldSummary,
		events: loadedEvents
	};
}
