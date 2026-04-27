import { describe, expect, it } from "vitest";
import type { LLMProvider } from "../llm-provider.js";
import { LLMProviderRegistry } from "../llm-provider-registry.js";

function makeProvider(): LLMProvider {
	return {
		chat: async () => ({
			content: "hello",
			model: "test-model",
			finishReason: "stop",
		}),
		chatWithTools: async () => ({
			content: null,
			toolCalls: [],
			model: "test-model",
			finishReason: "stop",
		}),
	};
}

describe("LLMProviderRegistry", () => {
	describe("register()", () => {
		it("registers a provider without throwing", () => {
			const registry = new LLMProviderRegistry();
			expect(() => registry.register("openai", makeProvider())).not.toThrow();
		});

		it("throws when the same name is registered twice", () => {
			const registry = new LLMProviderRegistry();
			registry.register("openai", makeProvider());
			expect(() => registry.register("openai", makeProvider())).toThrow(
				'LLMProvider "openai" is already registered',
			);
		});
	});

	describe("has()", () => {
		it("returns true after registration", () => {
			const registry = new LLMProviderRegistry();
			registry.register("anthropic", makeProvider());
			expect(registry.has("anthropic")).toBe(true);
		});

		it("returns false for an unregistered name", () => {
			expect(new LLMProviderRegistry().has("ghost")).toBe(false);
		});
	});

	describe("get()", () => {
		it("returns the registered provider instance", () => {
			const registry = new LLMProviderRegistry();
			const provider = makeProvider();
			registry.register("openai", provider);
			expect(registry.get("openai")).toBe(provider);
		});

		it("returns undefined for an unknown name", () => {
			expect(new LLMProviderRegistry().get("unknown")).toBeUndefined();
		});
	});

	describe("names()", () => {
		it("lists all registered provider names", () => {
			const registry = new LLMProviderRegistry();
			registry.register("openai", makeProvider());
			registry.register("anthropic", makeProvider());
			expect(registry.names().sort()).toEqual(["anthropic", "openai"]);
		});

		it("returns an empty array when nothing is registered", () => {
			expect(new LLMProviderRegistry().names()).toEqual([]);
		});
	});
});
