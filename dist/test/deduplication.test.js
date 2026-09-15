import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDeduplication, hashEvent } from "../src/deduplication.js";
function mockLoadedEvent(id, title, react) {
    return {
        event: {
            id,
            time: "2026-09-15T08:00:00Z",
            title,
            description: `Description of ${title}`,
            react: react ?? null
        },
        dayDate: "260915",
        filePath: "/fake/path/events.json",
        epochMs: 1789459200000
    };
}
test("hashEvent produces deterministic output and changes on react update", () => {
    const e1 = mockLoadedEvent("evt-1", "Walk in rain").event;
    const e2 = mockLoadedEvent("evt-1", "Walk in rain").event;
    assert.equal(hashEvent(e1), hashEvent(e2));
    const e3 = mockLoadedEvent("evt-1", "Walk in rain", { feeling: "happy" }).event;
    assert.notEqual(hashEvent(e1), hashEvent(e3));
});
test("evaluateDeduplication handles first injection and no-op repeats", () => {
    const events = [mockLoadedEvent("evt-1", "Event 1"), mockLoadedEvent("evt-2", "Event 2")];
    // First injection
    const decision1 = evaluateDeduplication(events, undefined);
    assert.equal(decision1.shouldInject, true);
    assert.equal(decision1.isFirstInjection, true);
    assert.equal(decision1.newEvents.length, 2);
    // Repeated turn with exact same events
    const decision2 = evaluateDeduplication(events, decision1.nextState);
    assert.equal(decision2.shouldInject, false);
    assert.equal(decision2.newEvents.length, 0);
    assert.equal(decision2.updatedEvents.length, 0);
});
test("evaluateDeduplication detects new events and react updates", () => {
    const eventsInitial = [mockLoadedEvent("evt-1", "Event 1")];
    const decision1 = evaluateDeduplication(eventsInitial, undefined);
    assert.equal(decision1.shouldInject, true);
    // Scenario A: An event's react is updated
    const eventsUpdated = [mockLoadedEvent("evt-1", "Event 1", { action: "Decided to go to market", updated_at: "2026-09-15T09:00:00Z" })];
    const decision2 = evaluateDeduplication(eventsUpdated, decision1.nextState);
    assert.equal(decision2.shouldInject, true);
    assert.equal(decision2.newEvents.length, 0);
    assert.equal(decision2.updatedEvents.length, 1);
    assert.equal(decision2.updatedEvents[0].event.id, "evt-1");
    // Scenario B: A new event occurs
    const eventsWithNew = [
        eventsUpdated[0],
        mockLoadedEvent("evt-2", "Afternoon Book Fair")
    ];
    const decision3 = evaluateDeduplication(eventsWithNew, decision2.nextState);
    assert.equal(decision3.shouldInject, true);
    assert.equal(decision3.newEvents.length, 1);
    assert.equal(decision3.newEvents[0].event.id, "evt-2");
    assert.equal(decision3.updatedEvents.length, 0);
});
