import type { ExecutionContext, NodeInput, NodeOutput } from "./types.js";

/** A function that executes a single workflow node. */
export type NodeExecutor = (
	input: NodeInput,
	context: ExecutionContext,
) => Promise<NodeOutput>;

/**
 * Registry that maps node type strings to their executor implementations.
 * Executors are registered at application startup (e.g. by packages/nodes).
 */
export class NodeRegistry {
	private readonly executors = new Map<string, NodeExecutor>();

	/**
	 * Register an executor for a node type.
	 * Throws if an executor for the given type is already registered.
	 */
	register(type: string, executor: NodeExecutor): void {
		if (this.executors.has(type)) {
			throw new Error(`NodeExecutor for type "${type}" is already registered`);
		}
		this.executors.set(type, executor);
	}

	/**
	 * Execute a node by type using the registered executor.
	 * If no executor is registered for the type, a forward-compatible no-op
	 * is returned so workflows with unknown node types do not hard-fail.
	 */
	async execute(
		type: string,
		input: NodeInput,
		context: ExecutionContext,
	): Promise<NodeOutput> {
		const executor = this.executors.get(type);
		if (!executor) {
			return {
				data: {},
				status: "success",
				logs: `Node type "${type}" has no registered executor — executed as no-op (runId: ${context.runId}).`,
			};
		}
		return executor(input, context);
	}

	/** Returns true if an executor for the given type has been registered. */
	has(type: string): boolean {
		return this.executors.has(type);
	}

	/** Returns all registered node type names. */
	types(): string[] {
		return Array.from(this.executors.keys());
	}
}

/** Singleton registry used by the default server setup. */
export const defaultNodeRegistry = new NodeRegistry();
