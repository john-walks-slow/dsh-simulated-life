/**
 * life_react tool: Allows an agent to record its feeling, thought, and action reactions
 * to a specific simulated life event in its workspace.
 */
import { readdir, readFile, writeFile, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
async function isDirectory(path) {
    try {
        const s = await stat(path);
        return s.isDirectory();
    }
    catch {
        return false;
    }
}
/**
 * Scan workspace .life directory to find the event with the given ID.
 * Early breaks once found for optimal I/O.
 */
async function findEventInWorkspace(workspaceDir, targetEventId) {
    const lifeDir = join(workspaceDir, ".life");
    if (!(await isDirectory(lifeDir))) {
        return { allEventSummaries: [] };
    }
    let entries = [];
    try {
        entries = await readdir(lifeDir);
    }
    catch {
        return { allEventSummaries: [] };
    }
    const allEventSummaries = [];
    let found;
    // Sort directories descending to search recent days first
    const sortedEntries = entries.sort().reverse();
    for (const entry of sortedEntries) {
        const dayDirPath = join(lifeDir, entry);
        if (!(await isDirectory(dayDirPath)))
            continue;
        const eventsFilePath = join(dayDirPath, "events.json");
        let contentStr;
        try {
            contentStr = await readFile(eventsFilePath, "utf8");
        }
        catch {
            continue;
        }
        let dayData;
        try {
            dayData = JSON.parse(contentStr);
        }
        catch {
            continue;
        }
        if (!dayData || !Array.isArray(dayData.events))
            continue;
        for (let i = 0; i < dayData.events.length; i++) {
            const evt = dayData.events[i];
            if (!evt || !evt.id)
                continue;
            allEventSummaries.push({ id: evt.id, title: evt.title, day: entry });
            if (!found && evt.id === targetEventId) {
                found = {
                    filePath: eventsFilePath,
                    dayData,
                    eventIndex: i,
                    event: evt
                };
                break;
            }
        }
        if (found) {
            break;
        }
    }
    return { found, allEventSummaries };
}
/**
 * Define the life_react tool.
 */
export function createLifeReactTool() {
    return defineTool({
        name: "life_react",
        description: "记录或更新你对某件生活事件的感受、思考与行动反应。这些反应将持久化保存在你的生活日志中，并在明天的世界演算中产生真实的因果影响。",
        parameters: {
            eventId: {
                type: "string",
                description: "目标事件的唯一 ID（例如 'evt-260915-001'，来源于上下文中的 [Simulated Life Context] 列表）",
                required: true
            },
            feeling: {
                type: "string",
                description: "你对该事件的直观情绪与心理感受（例如：'感到意外而温暖'、'有些疲惫但充实'）"
            },
            thought: {
                type: "string",
                description: "你对该事件的深入思考或推演（例如：'陈伯提到的旧诗集很可能是绝版初版，下午有空去看看'）"
            },
            action: {
                type: "string",
                description: "你采取或决定采取的具体行动（例如：'向陈伯道谢并借了伞，决定下午前往集市'）"
            }
        },
        output: {
            schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                    success: { type: "boolean", required: true },
                    eventId: { type: "string", required: true },
                    eventTitle: { type: "string", required: true },
                    message: { type: "string", required: true }
                }
            },
            render: (_args, value) => [
                {
                    type: "text",
                    text: value.message
                }
            ]
        },
        async execute(input, exec) {
            const workspaceDir = exec.agent?.session.header.cwd;
            if (!workspaceDir) {
                throw new Error("life_react: 无法获取当前 Agent 的工作目录 (session header cwd is undefined)。");
            }
            const eventId = String(input.eventId || "").trim();
            if (!eventId) {
                throw new Error("life_react: 必须提供非空的 eventId。");
            }
            const feeling = typeof input.feeling === "string" ? input.feeling.trim() : undefined;
            const thought = typeof input.thought === "string" ? input.thought.trim() : undefined;
            const action = typeof input.action === "string" ? input.action.trim() : undefined;
            if (!feeling && !thought && !action) {
                throw new Error("life_react: 至少需要提供 feeling、thought、action 中的一项。");
            }
            const { found, allEventSummaries } = await findEventInWorkspace(workspaceDir, eventId);
            if (!found) {
                const availableList = allEventSummaries.length > 0
                    ? allEventSummaries
                        .slice(0, 10)
                        .map((e) => `• [${e.id}] ${e.title} (${e.day})`)
                        .join("\n")
                    : "(当前工作区 .life 下无可用事件)";
                throw new Error(`life_react: 未找到 ID 为 "${eventId}" 的生活事件。\n可用事件列表如下:\n${availableList}`);
            }
            const { filePath, dayData, eventIndex, event } = found;
            const existingReact = event.react || {};
            const updatedReact = {
                ...existingReact,
                ...(feeling !== undefined ? { feeling } : {}),
                ...(thought !== undefined ? { thought } : {}),
                ...(action !== undefined ? { action } : {}),
                updated_at: new Date().toISOString()
            };
            dayData.events[eventIndex] = {
                ...event,
                react: updatedReact
            };
            // Atomic write
            const tmpPath = `${filePath}.tmp.${Date.now()}`;
            await writeFile(tmpPath, JSON.stringify(dayData, null, 2), "utf8");
            await rename(tmpPath, filePath);
            const parts = [];
            if (updatedReact.feeling)
                parts.push(`感受: ${updatedReact.feeling}`);
            if (updatedReact.thought)
                parts.push(`思考: ${updatedReact.thought}`);
            if (updatedReact.action)
                parts.push(`行动: ${updatedReact.action}`);
            return {
                success: true,
                eventId: event.id,
                eventTitle: event.title,
                message: `已成功记录对事件 [${event.id}] "${event.title}" 的反应 (${parts.join(" | ")})。已更新至 ${filePath}。`
            };
        }
    });
}
