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

/** A single step in the workflow execution graph. */
export interface WorkflowStep {
	/** Unique name used to identify the step and as a dependency reference. */
	name: string;
	/** Step type — determines which NodeExecutor handles it. */
	type: string;
	/** Type-specific configuration passed verbatim to the executor. */
	config?: Record<string, unknown>;
	/** Names of steps that must complete before this step runs. */
	dependsOn?: string[];
}

/** The execution-format workflow definition consumed by WorkflowExecutor. */
export interface WorkflowDefinition {
	steps?: WorkflowStep[];
	triggers?: Array<{ type: "cron"; cron: string }>;
}

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
