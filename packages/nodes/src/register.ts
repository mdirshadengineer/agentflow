import type { NodeRegistry } from "@mdirshadengineer/agentflow-core";
import { delayExecutor } from "./executors/delay.js";
import { httpRequestExecutor } from "./executors/http-request.js";
import { logExecutor } from "./executors/log.js";
import { noopExecutor } from "./executors/noop.js";

/**
 * Register all built-in node executors with the given {@link NodeRegistry}.
 *
 * Call this once at application startup before any workflow is executed:
 *
 * ```ts
 * import { defaultNodeRegistry } from "@mdirshadengineer/agentflow-core";
 * import { registerAll } from "@mdirshadengineer/agentflow-nodes";
 *
 * registerAll(defaultNodeRegistry);
 * ```
 */
export function registerAll(registry: NodeRegistry): void {
	registry.register("noop", noopExecutor);
	registry.register("http-request", httpRequestExecutor);
	registry.register("delay", delayExecutor);
	registry.register("log", logExecutor);
}
