/**
 * dsh-simulated-life — Simulated life context and world evolution for DeepSeek Harness.
 */
import { boundContextSummary, createUserMessage } from "@deepseek-ai/dsh-llm";
import z from "@deepseek-ai/schemastery";
import { loadRecentLifeEvents } from "./loader.js";
import { evaluateDeduplication } from "./deduplication.js";
import { formatLifeContext, formatNoticeSummary } from "./formatter.js";
import { createLifeReactTool } from "./tools/life-react.js";
/** Cordis plugin name used by loader diagnostics and message attribution. */
export const name = "dsh-simulated-life";
/** The required services for tools and agent events. */
export const inject = ["agents", "tools"];
/** Schemastery validation for plugin configuration. */
export const Config = z.object({
    windowHours: z.number().default(24).description("事件回溯滑动窗口时长（小时，默认 24）"),
    enabled: z.boolean().default(true).description("是否启用模拟生活事件注入")
});
const MAX_TRACKED_SESSIONS = 200;
/**
 * Handle a single pre-step decision to inject 24h simulated events.
 */
export async function handleLifePreStep(agent, step, aborted, sessionState, windowHours, now = Date.now()) {
    if (aborted || step !== 1) {
        return {};
    }
    const workspaceDir = agent.session.header.cwd;
    if (!workspaceDir) {
        return {};
    }
    const lifeWindow = await loadRecentLifeEvents(workspaceDir, now, windowHours);
    if (!lifeWindow || lifeWindow.events.length === 0) {
        return {};
    }
    const dedupResult = evaluateDeduplication(lifeWindow.events, sessionState);
    if (!dedupResult.shouldInject) {
        return { nextState: dedupResult.nextState };
    }
    const isDelta = !dedupResult.isFirstInjection && dedupResult.newEvents.length + dedupResult.updatedEvents.length < dedupResult.activeEvents.length;
    const eventsToFormat = isDelta
        ? [...dedupResult.newEvents, ...dedupResult.updatedEvents]
        : dedupResult.activeEvents;
    const formattedText = formatLifeContext(eventsToFormat, lifeWindow.worldSummary, isDelta);
    if (!formattedText) {
        return { nextState: dedupResult.nextState };
    }
    const summaryText = formatNoticeSummary(eventsToFormat.length, isDelta);
    const message = createUserMessage({
        content: [{ type: "text", text: formattedText }],
        source: {
            kind: "plugin",
            plugin: name,
            form: "notice",
            summary: boundContextSummary(summaryText)
        }
    });
    return {
        message,
        nextState: dedupResult.nextState
    };
}
/**
 * Register dsh-simulated-life plugin for the lifetime of `ctx`.
 */
export function apply(ctx, config = {}) {
    const windowHours = config.windowHours ?? 24;
    const enabled = config.enabled ?? true;
    if (!enabled) {
        return;
    }
    // Register life_react tool
    ctx.tools.register(createLifeReactTool());
    // In-memory projection store mapping sessionId to tracked state (with LRU eviction)
    const sessionMemoryStates = new Map();
    ctx.on("agent/pre-step", async (payload, next) => {
        const decision = await next();
        if (decision.kind !== "enter")
            return decision;
        try {
            const sessionId = String(payload.agent.session.id);
            const currentState = sessionMemoryStates.get(sessionId);
            const result = await handleLifePreStep(payload.agent, payload.step, payload.signal.aborted, currentState, windowHours);
            if (result.nextState) {
                // Guard against unbounded map growth
                if (sessionMemoryStates.size >= MAX_TRACKED_SESSIONS && !sessionMemoryStates.has(sessionId)) {
                    const oldestKey = sessionMemoryStates.keys().next().value;
                    if (oldestKey !== undefined)
                        sessionMemoryStates.delete(oldestKey);
                }
                sessionMemoryStates.set(sessionId, result.nextState);
            }
            if (result.message) {
                return {
                    ...decision,
                    messages: [...decision.messages, result.message]
                };
            }
        }
        catch (error) {
            // Non-fatal: log warning and continue without breaking the session
            ctx.logger?.warn("dsh-simulated-life: failed to inject life events", error);
        }
        return decision;
    }, { prepend: true });
}
