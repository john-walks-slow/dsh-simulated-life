#!/usr/bin/env node

/**
 * True Random Dice Roller for create-simulated-events skill.
 * Uses node:crypto randomInt for unbias, cryptographic entropy.
 */

import { randomInt } from "node:crypto";

export function roll(diceMax) {
	return randomInt(1, diceMax + 1);
}

export function rollDailyFate() {
	return {
		daily_fortune: roll(100), // 1d100
		event_count: roll(4) + 1, // 2 to 5 events
		weather_seed: roll(20),   // 1d20
		chaos_factor: roll(10)    // 1d10
	};
}

if (import.meta.url === `file://${process.argv[1]}`) {
	console.log(JSON.stringify(rollDailyFate(), null, 2));
}
