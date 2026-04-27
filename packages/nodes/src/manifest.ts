import type { JsonSchema } from "@mdirshadengineer/agentflow-core";

import delayManifestJson from "./nodes/delay.json" with { type: "json" };
import httpRequestManifestJson from "./nodes/http-request.json" with {
	type: "json",
};
import logManifestJson from "./nodes/log.json" with { type: "json" };
import noopManifestJson from "./nodes/noop.json" with { type: "json" };

/**
 * Static metadata that describes a node type.
 * Each built-in node ships a corresponding JSON file under `src/nodes/`.
 */
export interface NodeManifest {
	/** Unique node type identifier — matches {@link WorkflowStep.type}. */
	type: string;
	/** Human-readable display name shown in the workflow editor UI. */
	label: string;
	/** One-sentence description of what the node does. */
	description: string;
	/**
	 * JSON Schema describing the node's `config` object
	 * (i.e. {@link WorkflowStep.config}).
	 */
	configSchema: JsonSchema;
	/**
	 * JSON Schema describing the `data` field of the node's
	 * {@link NodeOutput} object.
	 */
	outputSchema: JsonSchema;
}

/** All built-in node manifests, in registration order. */
export const allManifests: NodeManifest[] = [
	noopManifestJson as NodeManifest,
	httpRequestManifestJson as NodeManifest,
	delayManifestJson as NodeManifest,
	logManifestJson as NodeManifest,
];

/**
 * Look up a manifest by node type string.
 * Returns `undefined` when no built-in manifest exists for the given type.
 */
export function getManifest(type: string): NodeManifest | undefined {
	return allManifests.find((m) => m.type === type);
}
