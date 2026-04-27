import type { JsonSchema } from "./types.js";

/** Definition of a tool that can be invoked by AI agents via LLM function-calling. */
export interface ToolDefinition {
	/** Unique machine-readable name — used as the function name in LLM APIs. */
	name: string;
	/** Human-readable description of what the tool does. */
	description: string;
	/** JSON Schema describing the tool's input arguments. */
	inputSchema: JsonSchema;
	/** Execute the tool with the given arguments and return an arbitrary result. */
	execute(args: Record<string, unknown>): Promise<unknown>;
}

/**
 * Registry that maps tool names to their ToolDefinition implementations.
 * Tools are registered at startup; custom tools may be registered via plugins.
 */
export class ToolRegistry {
	private readonly tools = new Map<string, ToolDefinition>();

	/**
	 * Register a tool definition.
	 * Throws if a tool with the same name is already registered.
	 */
	register(tool: ToolDefinition): void {
		if (this.tools.has(tool.name)) {
			throw new Error(`Tool "${tool.name}" is already registered`);
		}
		this.tools.set(tool.name, tool);
	}

	/** Retrieve a tool definition by name. Returns undefined if not found. */
	get(name: string): ToolDefinition | undefined {
		return this.tools.get(name);
	}

	/** List all registered tool definitions. */
	list(): ToolDefinition[] {
		return Array.from(this.tools.values());
	}

	/** Returns true if a tool with the given name has been registered. */
	has(name: string): boolean {
		return this.tools.has(name);
	}
}

/** Singleton registry used by the default server setup. */
export const defaultToolRegistry = new ToolRegistry();
