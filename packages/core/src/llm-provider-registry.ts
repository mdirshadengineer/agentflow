import type { LLMProvider } from "./llm-provider.js";

/**
 * Registry that maps provider name strings to LLMProvider instances.
 * Providers are registered at startup and resolved by name from agent configs.
 */
export class LLMProviderRegistry {
	private readonly providers = new Map<string, LLMProvider>();

	/**
	 * Register a provider under a given name.
	 * Throws if a provider with the same name is already registered.
	 */
	register(name: string, provider: LLMProvider): void {
		if (this.providers.has(name)) {
			throw new Error(`LLMProvider "${name}" is already registered`);
		}
		this.providers.set(name, provider);
	}

	/** Retrieve a provider by name. Returns undefined if not found. */
	get(name: string): LLMProvider | undefined {
		return this.providers.get(name);
	}

	/** Returns all registered provider names. */
	names(): string[] {
		return Array.from(this.providers.keys());
	}

	/** Returns true if a provider with the given name has been registered. */
	has(name: string): boolean {
		return this.providers.has(name);
	}
}

/** Singleton registry used by the default server setup. */
export const defaultLLMProviderRegistry = new LLMProviderRegistry();
