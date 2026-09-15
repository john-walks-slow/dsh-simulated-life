/**
 * Markdown formatter and notice summary generator for simulated life events.
 */

import type { LoadedLifeEvent, SimulatedEvent } from "./types.js";

/**
 * Format timestamp into compact HH:mm representation.
 * Preserves the original ISO time's local hour and minute if explicit timezone offset is present.
 */
export function formatTimeOnly(isoTimeStr: string): string {
	if (typeof isoTimeStr !== "string" || !isoTimeStr.trim()) return "";

	// Match ISO time pattern: e.g. "2026-09-15T08:30:00+08:00" or "08:30:00"
	const timeMatch = isoTimeStr.match(/T(\d{2}):(\d{2})/);
	if (timeMatch) {
		return `${timeMatch[1]}:${timeMatch[2]}`;
	}

	const d = new Date(isoTimeStr);
	if (Number.isNaN(d.getTime())) return isoTimeStr;

	const hours = String(d.getHours()).padStart(2, "0");
	const minutes = String(d.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}

/**
 * Map event type to friendly Chinese tag.
 */
function getTypeName(type?: string): string {
	switch (type) {
		case "routine":
			return "日常起居";
		case "encounter":
			return "偶然际遇";
		case "accident":
			return "突发插曲";
		case "work":
			return "工作探索";
		case "social":
			return "社交人际";
		case "fate":
			return "宿命事件";
		default:
			return type ? String(type) : "生活事件";
	}
}

/**
 * Format a single simulated event into readable markdown list item.
 */
export function formatSingleEvent(loaded: LoadedLifeEvent): string {
	const evt: SimulatedEvent = loaded.event;
	const timeStr = formatTimeOnly(evt.time);
	const typeName = getTypeName(evt.type);
	const actorsStr = evt.actors && evt.actors.length > 0 ? ` (相关人物: ${evt.actors.join("、")})` : "";
	const locationStr = evt.location ? ` @ ${evt.location}` : "";

	let lines: string[] = [];
	lines.push(`• [${timeStr}] [${typeName}] ${evt.title}${actorsStr}${locationStr} (id: \`${evt.id}\`)`);
	lines.push(`  ${evt.description}`);

	if (evt.impact) {
		lines.push(`  └ 影响: ${evt.impact}`);
	}

	if (evt.react && (evt.react.feeling || evt.react.thought || evt.react.action)) {
		const parts: string[] = [];
		if (evt.react.feeling) parts.push(`感受: ${evt.react.feeling}`);
		if (evt.react.thought) parts.push(`思考: ${evt.react.thought}`);
		if (evt.react.action) parts.push(`行动: ${evt.react.action}`);
		lines.push(`  └ 你的反应: ${parts.join(" | ")}`);
	} else {
		lines.push(`  └ [反应状态: 尚未记录反应]`);
	}

	return lines.join("\n");
}

/**
 * Format a complete simulated life context message.
 */
export function formatLifeContext(
	events: LoadedLifeEvent[],
	worldSummary?: string,
	isDelta: boolean = false
): string {
	if (events.length === 0) return "";

	const lines: string[] = [];
	const headerTitle = isDelta
		? "【Simulated Life | 近期生活事件与反应更新】"
		: "【Simulated Life | 近24小时发生在你身上的生活事件】";

	lines.push(headerTitle);

	if (worldSummary) {
		lines.push(`> 世界近况: ${worldSummary}\n`);
	}

	for (const loaded of events) {
		lines.push(formatSingleEvent(loaded));
	}

	lines.push("");
	lines.push(
		"*你可以将这些生活经历自然融入与用户的对话或日常思考中。如需记录/更新对某事件的感受、思考或行动决策，可调用 `life_react` 工具。*"
	);

	return lines.join("\n");
}

/**
 * Build a concise notice summary for the plugin source attribution.
 */
export function formatNoticeSummary(eventCount: number, isDelta: boolean): string {
	if (isDelta) {
		return `更新了 ${eventCount} 条生活事件反应`;
	}
	return `载入了近24小时内 ${eventCount} 条生活事件`;
}
