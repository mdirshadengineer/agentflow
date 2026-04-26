import type { Edge, Node } from "@xyflow/react"

// ── Trigger node ──────────────────────────────────────────────────────────────

export type TriggerType = "manual" | "scheduled" | "webhook"

export interface TriggerNodeData extends Record<string, unknown> {
	label: string
	triggerType: TriggerType
	/** Cron expression — only meaningful when triggerType === "scheduled" */
	cron?: string
	/** URL path suffix — only meaningful when triggerType === "webhook" */
	webhookPath?: string
}

// ── Agent node ────────────────────────────────────────────────────────────────

export interface AgentNodeData extends Record<string, unknown> {
	label: string
	/** ID of the agent record in the agents table */
	agentId: string
	/** Denormalised display name — refreshed from the DB when opening the editor */
	agentName?: string
	/** Optional prompt override for this step */
	prompt?: string
}

// ── Condition node ────────────────────────────────────────────────────────────

export interface ConditionNodeData extends Record<string, unknown> {
	label: string
	/**
	 * A JavaScript expression evaluated against `{ output }` where `output` is
	 * the previous step's output object.  Must return a truthy/falsy value.
	 * e.g. `output.status === "approved"`
	 */
	condition: string
}

// ── Output node ───────────────────────────────────────────────────────────────

export interface OutputNodeData extends Record<string, unknown> {
	label: string
	/** Optional key used to namespace this output in the final run output map */
	outputKey?: string
}

// ── Union types ───────────────────────────────────────────────────────────────

export type WorkflowNodeType = "trigger" | "agent" | "condition" | "output"

export type WorkflowNode =
	| Node<TriggerNodeData, "trigger">
	| Node<AgentNodeData, "agent">
	| Node<ConditionNodeData, "condition">
	| Node<OutputNodeData, "output">

export type WorkflowEdge = Edge

/** The shape stored verbatim in the `definition` TEXT column of the workflows table. */
export interface WorkflowDefinition {
	nodes: WorkflowNode[]
	edges: WorkflowEdge[]
}
