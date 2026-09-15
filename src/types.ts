/**
 * Core type definitions for dsh-simulated-life.
 */

export type EventType =
	| "routine"
	| "encounter"
	| "accident"
	| "work"
	| "social"
	| "fate"
	| (string & {});

export interface EventReaction {
	feeling?: string;
	thought?: string;
	action?: string;
	updated_at?: string;
}

export interface SimulatedEvent {
	id: string;
	time: string; // ISO 8601 string, e.g. "2026-09-15T08:30:00+08:00"
	type?: EventType;
	category?: string;
	title: string;
	description: string;
	actors?: string[];
	location?: string;
	importance?: number; // 1 to 5
	impact?: string;
	react?: EventReaction | null;
}

export interface LifeDayData {
	date: string; // e.g. "260915"
	timezone?: string;
	world_summary?: string;
	events: SimulatedEvent[];
}

export interface LoadedLifeEvent {
	event: SimulatedEvent;
	dayDate: string;
	filePath: string;
	epochMs: number;
}

export interface LifeEventsWindow {
	worldSummary?: string;
	events: LoadedLifeEvent[];
}

/**
 * Tracked injected state for deduplication within one session.
 */
export interface InjectedEventRecord {
	id: string;
	time: string;
	reactUpdatedAt?: string;
	contentHash: string;
}

export interface SessionLifeProjectionState {
	injectedEvents: Record<string, InjectedEventRecord>;
	lastInjectedTime: number | null;
}
