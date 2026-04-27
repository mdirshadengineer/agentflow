import { NodeRegistry } from "@mdirshadengineer/agentflow-core";
import { describe, expect, it } from "vitest";
import { allManifests, getManifest } from "../manifest.js";
import { registerAll } from "../register.js";

const EXPECTED_TYPES = ["noop", "http-request", "delay", "log"];

// ── allManifests ──────────────────────────────────────────────────────────────

describe("allManifests", () => {
	it("contains exactly the built-in node types", () => {
		const types = allManifests.map((m) => m.type).sort();
		expect(types).toEqual([...EXPECTED_TYPES].sort());
	});

	it("every manifest has required fields", () => {
		for (const m of allManifests) {
			expect(typeof m.type).toBe("string");
			expect(m.type.length).toBeGreaterThan(0);
			expect(typeof m.label).toBe("string");
			expect(typeof m.description).toBe("string");
			expect(m.configSchema).toBeDefined();
			expect(m.outputSchema).toBeDefined();
		}
	});

	it("every configSchema has type 'object'", () => {
		for (const m of allManifests) {
			expect(m.configSchema.type).toBe("object");
		}
	});
});

// ── getManifest ───────────────────────────────────────────────────────────────

describe("getManifest", () => {
	it("returns the manifest for a known type", () => {
		const m = getManifest("noop");
		expect(m).toBeDefined();
		expect(m?.type).toBe("noop");
	});

	it("returns undefined for an unknown type", () => {
		expect(getManifest("unknown-xyz")).toBeUndefined();
	});
});

// ── registerAll ───────────────────────────────────────────────────────────────

describe("registerAll", () => {
	it("registers all built-in types into a NodeRegistry", () => {
		const registry = new NodeRegistry();
		registerAll(registry);
		for (const type of EXPECTED_TYPES) {
			expect(registry.has(type)).toBe(true);
		}
	});

	it("registered types match allManifests types", () => {
		const registry = new NodeRegistry();
		registerAll(registry);
		const registeredTypes = registry.types().sort();
		const manifestTypes = allManifests.map((m) => m.type).sort();
		expect(registeredTypes).toEqual(manifestTypes);
	});
});
