// ── Node execution types ──────────────────────────────────────────────────────

/** The input passed to a node executor. */
export interface NodeInput {
	/** The node's config JSON from the workflow definition. */
	data: Record<string, unknown>;
	/** Outputs produced by upstream steps, keyed by step name. */
	previousOutputs: Record<string, NodeOutput>;
	/** The ID of the current workflow run. */
	runId: string;
	/** The ID of the workflow being executed. */
	workflowId: string;
}

/** The result returned by a node executor. */
export interface NodeOutput {
	/** Arbitrary JSON result data produced by the node. */
	data: Record<string, unknown>;
	/** Execution status. */
	status: "success" | "failed";
	/** Human-readable log string captured during execution. */
	logs: string;
}

/** Context provided to every node executor during workflow execution. */
export interface ExecutionContext {
	/** The ID of the current workflow run. */
	runId: string;
	/** The ID of the workflow being executed. */
	workflowId: string;
}

// ── Workflow definition types ─────────────────────────────────────────────────

/** Retry policy for a workflow step. */
export interface StepRetryPolicy {
	/** Maximum number of total attempts (including the first). Must be ≥ 1. */
	maxAttempts: number;
	/** Base delay between attempts in milliseconds. */
	delayMs: number;
	/** Backoff strategy: linear keeps `delayMs` constant; exponential doubles it each attempt. */
	backoff?: "linear" | "exponential";
}

/** A single step in the workflow execution graph. */
export interface WorkflowStep {
	/** Unique name used to identify the step and as a dependency reference. */
	name: string;
	/** Step type — determines which NodeExecutor handles it. */
	type: string;
	/** Node definition version used when this step was saved (omit = latest). */
	version?: number;
	/** Type-specific configuration passed verbatim to the executor. */
	config?: Record<string, unknown>;
	/** Names of steps that must complete before this step runs. */
	dependsOn?: string[];
	/** Retry policy — when omitted the step is attempted exactly once. */
	retry?: StepRetryPolicy;
	/**
	 * When true, downstream steps are not skipped even if this step fails.
	 * Defaults to false (fail-fast propagation).
	 */
	continueOnFail?: boolean;
	/**
	 * Maximum execution time in milliseconds.
	 * When exceeded the step is treated as failed with a timeout error.
	 * Omit to disable the timeout.
	 */
	timeout?: number;
}

/** The execution-format workflow definition consumed by WorkflowExecutor. */
export interface WorkflowDefinition {
	steps?: WorkflowStep[];
	triggers?: Array<{ type: "cron"; cron: string }>;
}

// ── Expression / compilation types ─────────────────────────────────────────────

export type PathSegment = string | number;

export type ExprAst =
	| {
			kind: "StepRef";
			stepId: string;
			port: string;
			path: PathSegment[];
	  }
	| { kind: "Literal"; value: unknown }
	| { kind: "Call"; fn: string; args: ExprAst[] };

export type TemplateAst = Array<
	{ kind: "Text"; value: string } | { kind: "Expr"; expr: ExprAst }
>;

export type ConfigValue =
	| { kind: "literal"; value: unknown }
	| { kind: "expression"; source: string; ast: ExprAst }
	| { kind: "template"; source: string; ast: TemplateAst };

export interface CredentialRef {
	credentialId: string;
	expectedType: string;
}

export interface InputBinding {
	type: "edge" | "expression" | "literal";
	port?: string;
	value?: ConfigValue;
}

export interface WorkflowStepDefinition {
	id: string;
	type: string;
	version: number;
	name: string;
	config: Record<string, ConfigValue>;
	inputBindings?: Record<string, InputBinding>;
	credentialBindings?: Record<string, CredentialRef>;
	retry?: StepRetryPolicy;
	continueOnFail?: boolean;
	timeoutMs?: number;
}

export interface WorkflowCompileError {
	code:
		| "cycle"
		| "invalid_expression"
		| "unknown_step_reference"
		| "non_upstream_reference"
		| "missing_required_field";
	message: string;
	stepName?: string;
	field?: string;
	reference?: string;
}

export interface SymbolTableStep {
	stepId: string;
	label: string;
	outputs: Record<string, JsonSchema>;
}

export interface SymbolTable {
	steps: Record<string, SymbolTableStep>;
}

export interface ExecutionPlan {
	steps: WorkflowStep[];
	dependencies: Record<string, string[]>;
	topologicalLevels: string[][];
	schemas: Record<string, { output?: JsonSchema }>;
	credentialRefs: Record<string, Record<string, CredentialRef>>;
	symbolTable: SymbolTable;
	compiledConfig: Record<string, Record<string, ConfigValue>>;
}

export interface WorkflowCompileResult {
	definition: WorkflowDefinition;
	plan: ExecutionPlan;
	errors: WorkflowCompileError[];
}

// ── Node definition types ──────────────────────────────────────────────────────

export type PrimitiveType =
	| "string"
	| "number"
	| "boolean"
	| "object"
	| "array"
	| "json"
	| "any";

export interface TypeRef {
	kind: PrimitiveType | "ref";
	ref?: string;
	schema?: JsonSchema;
}

export interface NodeInputPort {
	name: string;
	title: string;
	required: boolean;
	multiple?: boolean;
	type: TypeRef;
	description?: string;
}

export interface NodeOutputPort {
	name: string;
	title: string;
	type: TypeRef;
	description?: string;
}

export interface NodeCredentialRequirement {
	name: string;
	credentialType: string;
	required: boolean;
	scopes?: string[];
}

export interface FieldVisibilityRule {
	when: string;
}

export interface ConfigFieldSchema {
	key: string;
	label: string;
	type:
		| "text"
		| "textarea"
		| "number"
		| "select"
		| "toggle"
		| "json"
		| "code"
		| "keyValue"
		| "expression"
		| "credential";
	required?: boolean;
	allowExpressions?: boolean;
	defaultValue?: unknown;
	placeholder?: string;
	description?: string;
	enum?: Array<{ label: string; value: string }>;
	validation?: {
		regex?: string;
		min?: number;
		max?: number;
		customRuleIds?: string[];
	};
	visibleWhen?: FieldVisibilityRule;
	dependsOn?: string[];
	credentialType?: string;
}

export interface NodeConfigSchema {
	fields: ConfigFieldSchema[];
	layout?: Array<{ section: string; fields: string[] }>;
}

export interface NodeExecutionArgs<TConfig = unknown> {
	step: WorkflowStep;
	config: TConfig;
	inputs: Record<string, unknown>;
	context: ExecutionContext;
	credentials: Record<string, unknown>;
	logger?: {
		log(message: string): void;
	};
	abortSignal?: AbortSignal;
}

export interface NodeExecutionResult<TOutput = unknown> {
	status: "success" | "failed";
	output: TOutput;
	error?: {
		code: string;
		message: string;
		retryable?: boolean;
	};
	logs?: string[];
}

export interface NodeExecutionHandler<TConfig = unknown, TOutput = unknown> {
	execute(
		args: NodeExecutionArgs<TConfig>,
	): Promise<NodeExecutionResult<TOutput>>;
}

export interface NodeMigration {
	fromVersion: number;
	toVersion: number;
	migrate(config: Record<string, unknown>): Record<string, unknown>;
}

export interface NodeDefinition<TConfig = unknown, TOutput = unknown> {
	type: string;
	version: number;
	label: string;
	description: string;
	category: string;
	icon?: string;
	inputs: NodeInputPort[];
	outputs: NodeOutputPort[];
	configSchema: NodeConfigSchema;
	configJsonSchema: JsonSchema;
	outputJsonSchema: JsonSchema;
	credentials?: NodeCredentialRequirement[];
	retryable?: boolean;
	idempotent?: boolean;
	handler: NodeExecutionHandler<TConfig, TOutput>;
	migrations?: NodeMigration[];
}

export type NodeCatalogEntry = Omit<NodeDefinition, "handler" | "migrations">;

// ── LLM types ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string;
	/** Present when role === "tool" to correlate with the assistant's tool call. */
	toolCallId?: string;
	/** Present on assistant messages that contain tool calls. */
	toolCalls?: ToolCall[];
}

export interface ToolCall {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

export interface LLMOptions {
	model?: string;
	temperature?: number;
	maxTokens?: number;
}

export interface LLMResponse {
	content: string;
	model: string;
	finishReason: string;
}

export interface LLMToolResponse {
	content: string | null;
	toolCalls: ToolCall[];
	model: string;
	finishReason: string;
}

// ── Tool types ────────────────────────────────────────────────────────────────

/** A simplified JSON Schema object used to describe tool inputs. */
export type JsonSchema = {
	type: string;
	properties?: Record<string, JsonSchema>;
	required?: string[];
	description?: string;
	items?: JsonSchema;
	[key: string]: unknown;
};

// ── Run / queue types ─────────────────────────────────────────────────────────

export interface QueuedRun {
	id: string;
	workflowId: string;
	triggerData?: unknown;
}

export type RunStatus = "queued" | "running" | "success" | "failed";

export type StepStatus =
	| "pending"
	| "running"
	| "success"
	| "failed"
	| "skipped";

export interface StepLog {
	stepName: string;
	status: StepStatus;
	logs: string | null;
	startedAt: Date | null;
	finishedAt: Date | null;
}

export interface LogEvent {
	type:
		| "step_init"
		| "step_start"
		| "step_complete"
		| "step_fail"
		| "step_skip";
	runId: string;
	stepName: string;
	timestamp: Date;
	logs?: string;
	status?: StepStatus;
}

// ── Plugin types ──────────────────────────────────────────────────────────────

/**
 * Minimal manifest shape expected by the plugin interface.
 * The full `NodeManifest` type lives in `packages/nodes` which must not be
 * imported here to avoid a circular dependency.
 */
export interface NodeManifestLike {
	type: string;
	label: string;
	description: string;
	[key: string]: unknown;
}

/**
 * Contract for a node plugin package.
 *
 * A plugin exposes its manifests so the server can return them via
 * `GET /api/v1/nodes`, and a `register()` function that adds its executor
 * implementations to the shared {@link NodeRegistry}.
 *
 * ```ts
 * import type { NodePlugin } from "@mdirshadengineer/agentflow-core";
 * export const myPlugin: NodePlugin = {
 *   manifests: [myManifest],
 *   register(registry) { registry.register("my-type", myExecutor); },
 * };
 * ```
 */
export interface NodePlugin {
	/** Static manifest metadata for every node type provided by this plugin. */
	manifests: NodeManifestLike[];
	/** Register executor implementations into the given registry. */
	register(registry: import("./node-registry.js").NodeRegistry): void;
}
