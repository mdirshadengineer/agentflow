import type {
	ConfigFieldSchema,
	JsonSchema,
	NodeCatalogEntry,
	NodeCredentialRequirement,
	NodeDefinition,
	NodeExecutor,
} from "@mdirshadengineer/agentflow-core";
import { delayExecutor } from "./executors/delay.js";
import { filterExecutor } from "./executors/filter.js";
import { httpRequestExecutor } from "./executors/http-request.js";
import { jsonExtractExecutor } from "./executors/json-extract.js";
import { logExecutor } from "./executors/log.js";
import { noopExecutor } from "./executors/noop.js";
import { subworkflowExecutor } from "./executors/subworkflow.js";
import { transformExecutor } from "./executors/transform.js";
import {
	allManifests,
	type NodeManifest,
	type NodePropertySchema,
} from "./manifest.js";

function wrapExecutor(executor: NodeExecutor): NodeDefinition["handler"] {
	return {
		async execute({ config, context }) {
			const output = await executor(
				{
					data: (config as Record<string, unknown>) ?? {},
					previousOutputs: {},
					runId: context.runId,
					workflowId: context.workflowId,
				},
				context,
			);
			return {
				status: output.status,
				output: output.data,
				...(output.logs ? { logs: [output.logs] } : {}),
				...(output.status === "failed"
					? { error: { code: "node_execution_failed", message: output.logs } }
					: {}),
			};
		},
	};
}

const handlerByType: Record<string, NodeDefinition["handler"]> = {
	noop: wrapExecutor(noopExecutor),
	"http-request": wrapExecutor(httpRequestExecutor),
	delay: wrapExecutor(delayExecutor),
	log: wrapExecutor(logExecutor),
	transform: wrapExecutor(transformExecutor),
	"json-extract": wrapExecutor(jsonExtractExecutor),
	filter: wrapExecutor(filterExecutor),
	subworkflow: wrapExecutor(subworkflowExecutor),
};

function inferFieldType(prop: NodePropertySchema): ConfigFieldSchema["type"] {
	if (prop["x-credential-type"]) return "credential";
	switch (prop["x-field-type"]) {
		case "code":
			return "code";
		case "key-value":
			return "keyValue";
		case "json-editor":
			return "json";
		case "expression":
			return "expression";
		default:
			break;
	}
	if (prop.enum) return "select";
	if (prop.type === "boolean") return "toggle";
	if (prop.type === "number") return "number";
	if (prop.type === "object") return "json";
	return "text";
}

function inferFieldDependencies(
	prop: NodePropertySchema,
): string[] | undefined {
	const expression = prop["x-show-if"];
	if (!expression) return undefined;
	const matches = Array.from(
		expression.matchAll(/config\.([A-Za-z0-9_]+)/g),
	).map((match) => match[1]);
	return matches.length > 0
		? Array.from(new Set(matches.filter((match): match is string => !!match)))
		: undefined;
}

function toConfigFields(manifest: NodeManifest): ConfigFieldSchema[] {
	const required = new Set(manifest.configSchema.required ?? []);
	return (
		Object.entries(manifest.configSchema.properties ?? {}).map(
			([key, prop], index) => ({
				key,
				label: key,
				type: inferFieldType(prop),
				required: required.has(key),
				allowExpressions:
					prop.type === "string" ||
					prop["x-field-type"] === "code" ||
					prop.type === "object",
				defaultValue: prop.default,
				description: prop.description,
				enum: Array.isArray(prop.enum)
					? prop.enum
							.filter((value): value is string => typeof value === "string")
							.map((value) => ({ label: value, value }))
					: undefined,
				validation:
					prop.minimum !== undefined ? { min: prop.minimum } : undefined,
				visibleWhen: prop["x-show-if"]
					? { when: prop["x-show-if"] }
					: undefined,
				dependsOn: inferFieldDependencies(prop),
				credentialType: prop["x-credential-type"],
				_order: prop["x-order"] ?? index,
			}),
		) as Array<ConfigFieldSchema & { _order: number }>
	)
		.sort((a, b) => (a._order ?? 0) - (b._order ?? 0))
		.map(({ _order: _unused, ...field }) => field);
}

function toCredentialRequirements(
	manifest: NodeManifest,
): NodeCredentialRequirement[] {
	return Object.entries(manifest.configSchema.properties ?? {})
		.filter(([, prop]) => typeof prop["x-credential-type"] === "string")
		.map(([key, prop]) => ({
			name: key,
			credentialType: prop["x-credential-type"] as string,
			required: (manifest.configSchema.required ?? []).includes(key),
		}));
}

function defaultOutputSchema(manifest: NodeManifest): JsonSchema {
	return manifest.outputSchema.type === "object"
		? (manifest.outputSchema as JsonSchema)
		: ({ type: "object" } as JsonSchema);
}

function toNodeDefinition(manifest: NodeManifest): NodeDefinition {
	const outputSchema = defaultOutputSchema(manifest);
	return {
		type: manifest.type,
		version: manifest.version,
		label: manifest.label,
		description: manifest.description,
		category: manifest.category ?? "General",
		...(manifest.icon ? { icon: manifest.icon } : {}),
		inputs: [],
		outputs: [
			{
				name: "output",
				title: "Output",
				type: { kind: "json", schema: outputSchema },
				description: manifest.description,
			},
		],
		configSchema: { fields: toConfigFields(manifest) },
		configJsonSchema: manifest.configSchema,
		outputJsonSchema: outputSchema,
		credentials: toCredentialRequirements(manifest),
		...(manifest.retryable !== undefined
			? { retryable: manifest.retryable }
			: {}),
		idempotent: manifest.retryable ?? false,
		handler: handlerByType[manifest.type] ?? wrapExecutor(noopExecutor),
	};
}

export const allNodeDefinitions: NodeDefinition[] =
	allManifests.map(toNodeDefinition);

export const allNodeCatalogEntries: NodeCatalogEntry[] = allNodeDefinitions.map(
	({ handler: _handler, migrations: _migrations, ...entry }) => entry,
);

export function getNodeDefinition(type: string): NodeDefinition | undefined {
	return allNodeDefinitions.find((definition) => definition.type === type);
}
