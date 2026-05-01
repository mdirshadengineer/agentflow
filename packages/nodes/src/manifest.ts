import type { JsonSchema } from "@mdirshadengineer/agentflow-core";

import delayManifestJson from "./nodes/delay.json" with { type: "json" };
import filterManifestJson from "./nodes/filter.json" with { type: "json" };
import httpRequestManifestJson from "./nodes/http-request.json" with {
	type: "json",
};
import jsonExtractManifestJson from "./nodes/json-extract.json" with {
	type: "json",
};
import logManifestJson from "./nodes/log.json" with { type: "json" };
import noopManifestJson from "./nodes/noop.json" with { type: "json" };
import subworkflowManifestJson from "./nodes/subworkflow.json" with {
	type: "json",
};
import transformManifestJson from "./nodes/transform.json" with {
	type: "json",
};

/**
 * Extended JSON Schema property descriptor used by the node configuration
 * form renderer.  Carries optional vendor extension keys (`x-*`) that the
 * frontend interprets to choose the right input widget.
 */
export interface NodePropertySchema extends JsonSchema {
	/**
	 * Controls which input widget is rendered for this field:
	 * - `"password"` — masked text input (for secrets).
	 * - `"code"` — monospace / multiline textarea.
	 * - `"key-value"` — dynamic key-value pair editor.
	 * - `"json-editor"` — formatted JSON textarea with syntax highlighting.
	 * - `"expression"` — explicit expression-only input.
	 */
	"x-field-type"?:
		| "password"
		| "code"
		| "key-value"
		| "json-editor"
		| "expression";
	/**
	 * JavaScript expression evaluated against the current `config` object.
	 * When the expression is falsy the field is hidden.
	 * Example: `"config.sendHeaders === true"`
	 */
	"x-show-if"?: string;
	/**
	 * When present, this field renders as a credential picker instead of a
	 * text input.  The value must match a registered credential type
	 * (e.g. `"header-auth"` or `"api-key"`).
	 */
	"x-credential-type"?: string;
	/** Explicit render order override (lower = first). */
	"x-order"?: number;
}

/**
 * Static metadata that describes a node type.
 * Each built-in node ships a corresponding JSON file under `src/nodes/`.
 */
export interface NodeManifest {
	/** Unique node type identifier — matches {@link WorkflowStep.type}. */
	type: string;
	/**
	 * Node definition schema version.
	 * Increment when the `configSchema` has breaking changes so that saved
	 * workflows can be migrated automatically.
	 */
	version: number;
	/** Human-readable display name shown in the workflow editor UI. */
	label: string;
	/** One-sentence description of what the node does. */
	description: string;
	/** Lucide icon name (e.g. `"Globe"`) or an absolute SVG URL. */
	icon?: string;
	/**
	 * Logical grouping shown in the node library panel
	 * (e.g. `"HTTP"`, `"Data"`, `"Control Flow"`).
	 */
	category?: string;
	/**
	 * List of credential type identifiers this node may use
	 * (e.g. `["header-auth", "api-key"]`).
	 */
	credentialTypes?: string[];
	/**
	 * When `true`, the executor is idempotent and safe to re-run after a
	 * transient failure.  The UI may offer automatic retry configuration.
	 */
	retryable?: boolean;
	/**
	 * JSON Schema describing the node's `config` object
	 * (i.e. {@link WorkflowStep.config}).
	 * Properties may carry `x-*` vendor extension keys (see
	 * {@link NodePropertySchema}).
	 */
	configSchema: {
		type: string;
		properties: Record<string, NodePropertySchema>;
		required?: string[];
		additionalProperties?: boolean;
	};
	/**
	 * JSON Schema describing the `data` field of the node's
	 * {@link NodeOutput} object.
	 */
	outputSchema: JsonSchema;
	/**
	 * Optional JSON Schema used to validate the trigger input data before
	 * the workflow starts.  Only relevant for trigger-type nodes.
	 */
	inputSchema?: JsonSchema;
}

/** All built-in node manifests, in registration order. */
export const allManifests: NodeManifest[] = [
	noopManifestJson as NodeManifest,
	httpRequestManifestJson as NodeManifest,
	delayManifestJson as NodeManifest,
	logManifestJson as NodeManifest,
	transformManifestJson as NodeManifest,
	jsonExtractManifestJson as NodeManifest,
	filterManifestJson as NodeManifest,
	subworkflowManifestJson as NodeManifest,
];

/**
 * Look up a manifest by node type string.
 * Returns `undefined` when no built-in manifest exists for the given type.
 */
export function getManifest(type: string): NodeManifest | undefined {
	return allManifests.find((m) => m.type === type);
}
