import { describe, expect, it } from "vitest";
import { parseCommandContext } from "../command-context.js";

describe("parseCommandContext", () => {
	it("returns empty args and flags for an empty argv", () => {
		const ctx = parseCommandContext([]);
		expect(ctx.args).toEqual([]);
		expect(ctx.flags).toEqual({});
	});

	it("parses a positional argument", () => {
		const ctx = parseCommandContext(["foo"]);
		expect(ctx.args).toEqual(["foo"]);
		expect(ctx.flags).toEqual({});
	});

	it("parses a boolean flag (standalone --flag)", () => {
		const ctx = parseCommandContext(["--verbose"]);
		expect(ctx.flags).toEqual({ verbose: true });
	});

	it("parses a flag with inline value (--flag=value)", () => {
		const ctx = parseCommandContext(["--name=hello"]);
		expect(ctx.flags).toEqual({ name: "hello" });
	});

	it("parses a flag with a separate value (--flag value)", () => {
		const ctx = parseCommandContext(["--port", "3001"]);
		expect(ctx.flags).toEqual({ port: 3001 });
	});

	it("coerces numeric string values to numbers", () => {
		const ctx = parseCommandContext(["--limit=20"]);
		expect(ctx.flags).toEqual({ limit: 20 });
	});

	it("coerces 'true' string to boolean true", () => {
		const ctx = parseCommandContext(["--detach=true"]);
		expect(ctx.flags).toEqual({ detach: true });
	});

	it("coerces 'false' string to boolean false", () => {
		const ctx = parseCommandContext(["--detach=false"]);
		expect(ctx.flags).toEqual({ detach: false });
	});

	it("keeps non-numeric string values as strings", () => {
		const ctx = parseCommandContext(["--name=my-agent"]);
		expect(ctx.flags).toEqual({ name: "my-agent" });
	});

	it("stops flag parsing after -- separator", () => {
		const ctx = parseCommandContext(["--json", "--", "--not-a-flag"]);
		expect(ctx.flags).toEqual({ json: true });
		expect(ctx.args).toEqual(["--not-a-flag"]);
	});

	it("mixes positional args and flags", () => {
		const ctx = parseCommandContext(["agent-id-123", "--json"]);
		expect(ctx.args).toEqual(["agent-id-123"]);
		expect(ctx.flags).toEqual({ json: true });
	});

	it("handles multiple flags together", () => {
		const ctx = parseCommandContext(["--follow", "--limit", "10", "--json"]);
		expect(ctx.flags).toEqual({ follow: true, limit: 10, json: true });
	});

	it("treats a flag followed by another flag as boolean", () => {
		const ctx = parseCommandContext(["--verbose", "--output", "file.txt"]);
		expect(ctx.flags).toEqual({ verbose: true, output: "file.txt" });
	});

	it("ignores empty tokens", () => {
		const ctx = parseCommandContext(["", "--json"]);
		expect(ctx.flags).toEqual({ json: true });
	});
});
