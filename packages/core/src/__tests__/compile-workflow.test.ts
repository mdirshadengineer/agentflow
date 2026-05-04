import { describe, expect, it } from "vitest";
import { compileWorkflow } from "../compile-workflow.js";
import type { NodeCatalogEntry } from "../types.js";

const nodeCatalog: NodeCatalogEntry[] = [
	{
		type: "http-request",
		version: 1,
		label: "HTTP Request",
		description: "Send a request",
		category: "HTTP",
		inputs: [],
		outputs: [
			{
				name: "output",
				title: "Output",
				type: {
					kind: "json",
					schema: {
						type: "object",
						properties: { body: { type: "string" } },
					},
				},
			},
		],
		configSchema: {
			fields: [
				{ key: "url", label: "URL", type: "text", required: true },
				{
					key: "credentialId",
					label: "Credential",
					type: "credential",
					credentialType: "header-auth",
				},
			],
		},
		configJsonSchema: { type: "object" },
		outputJsonSchema: {
			type: "object",
			properties: { body: { type: "string" } },
		},
		credentials: [
			{ name: "credentialId", credentialType: "header-auth", required: false },
		],
		retryable: true,
		idempotent: true,
	},
	{
		type: "log",
		version: 1,
		label: "Log",
		description: "Log a message",
		category: "Utility",
		inputs: [],
		outputs: [
			{
				name: "output",
				title: "Output",
				type: { kind: "json", schema: { type: "object" } },
			},
		],
		configSchema: {
			fields: [
				{ key: "message", label: "Message", type: "text", required: true },
			],
		},
		configJsonSchema: { type: "object" },
		outputJsonSchema: { type: "object" },
	},
];

describe("compileWorkflow", () => {
	it("builds execution metadata for a valid canvas workflow", () => {
		const result = compileWorkflow(
			{
				nodes: [
					{
						id: "fetch",
						type: "generic",
						data: {
							label: "Fetch",
							nodeType: "http-request",
							url: "https://example.com",
							credentialId: "cred-1",
						},
					},
					{
						id: "log-result",
						type: "generic",
						data: {
							label: "Log Result",
							nodeType: "log",
							message: "{{ steps.fetch.output.body }}",
						},
					},
				],
				edges: [{ id: "e1", source: "fetch", target: "log-result" }],
			},
			{ nodeCatalog },
		);

		expect(result.errors).toEqual([]);
		expect(result.plan.topologicalLevels).toEqual([["fetch"], ["log-result"]]);
		expect(result.plan.dependencies["log-result"]).toEqual(["fetch"]);
		expect(result.plan.symbolTable.steps.fetch.label).toBe("Fetch");
		expect(result.plan.credentialRefs.fetch.credentialId).toEqual({
			credentialId: "cred-1",
			expectedType: "header-auth",
		});
		expect(result.plan.compiledConfig["log-result"].message.kind).toBe(
			"expression",
		);
	});

	it("reports non-upstream references", () => {
		const result = compileWorkflow(
			{
				nodes: [
					{
						id: "a",
						type: "generic",
						data: {
							label: "A",
							nodeType: "log",
							message: "{{ steps.c.output }}",
						},
					},
					{
						id: "b",
						type: "generic",
						data: { label: "B", nodeType: "log", message: "ok" },
					},
					{
						id: "c",
						type: "generic",
						data: { label: "C", nodeType: "log", message: "ok" },
					},
				],
				edges: [
					{ id: "e1", source: "a", target: "b" },
					{ id: "e2", source: "b", target: "c" },
				],
			},
			{ nodeCatalog },
		);

		expect(
			result.errors.some((error) => error.code === "non_upstream_reference"),
		).toBe(true);
	});

	it("reports dependency cycles", () => {
		const result = compileWorkflow(
			{
				nodes: [
					{
						id: "a",
						type: "generic",
						data: { label: "A", nodeType: "log", message: "ok" },
					},
					{
						id: "b",
						type: "generic",
						data: { label: "B", nodeType: "log", message: "ok" },
					},
				],
				edges: [
					{ id: "e1", source: "a", target: "b" },
					{ id: "e2", source: "b", target: "a" },
				],
			},
			{ nodeCatalog },
		);

		expect(result.errors.some((error) => error.code === "cycle")).toBe(true);
	});
});
