/**
 * Deduplication and delta-detection engine for simulated life events within a session.
 */
import { createHash } from "node:crypto";
/**
 * Generate a deterministic fingerprint hash of an event content and reaction.
 */
export function hashEvent(event) {
    const reactKey = event.react
        ? `${event.react.feeling ?? ""}|${event.react.thought ?? ""}|${event.react.action ?? ""}|${event.react.updated_at ?? ""}`
        : "none";
    const raw = `${event.id}|${event.time}|${event.title}|${event.description}|${event.impact ?? ""}|${reactKey}`;
    return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}
/**
 * Evaluate loaded 24-hour events against the current session state.
 *
 * @param loadedEvents - All events falling within the 24-hour window
 * @param currentState - Current tracked injection state of this session
 * @param forceFull - Force full injection (e.g. on manual trigger)
 */
export function evaluateDeduplication(loadedEvents, currentState, forceFull = false) {
    const previousInjected = currentState?.injectedEvents ?? {};
    const isFirstInjection = Object.keys(previousInjected).length === 0;
    if (loadedEvents.length === 0) {
        return {
            shouldInject: false,
            isFirstInjection,
            newEvents: [],
            updatedEvents: [],
            activeEvents: [],
            nextState: currentState ?? { injectedEvents: {}, lastInjectedTime: null }
        };
    }
    const newEvents = [];
    const updatedEvents = [];
    const nextInjectedRecords = {};
    for (const loaded of loadedEvents) {
        const evt = loaded.event;
        const currentHash = hashEvent(evt);
        const prev = previousInjected[evt.id];
        if (!prev) {
            newEvents.push(loaded);
        }
        else if (prev.contentHash !== currentHash) {
            updatedEvents.push(loaded);
        }
        // Keep only events currently active in the 24h window (pruning stale records)
        nextInjectedRecords[evt.id] = {
            id: evt.id,
            time: evt.time,
            reactUpdatedAt: evt.react?.updated_at,
            contentHash: currentHash
        };
    }
    const hasChanges = isFirstInjection || newEvents.length > 0 || updatedEvents.length > 0 || forceFull;
    const nextState = {
        injectedEvents: nextInjectedRecords,
        lastInjectedTime: hasChanges ? Date.now() : currentState?.lastInjectedTime ?? null
    };
    return {
        shouldInject: hasChanges,
        isFirstInjection,
        newEvents,
        updatedEvents,
        activeEvents: loadedEvents,
        nextState
    };
}
