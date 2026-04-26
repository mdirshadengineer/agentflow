// ── Typed API helpers for /api/v1/workflows ──────────────────────────────────
// This is the ONLY module that knows the /api/v1/workflows URL prefix.

import type { WorkflowDefinition } from "@/types/workflow"

export interface Workflow {
	id: string
	name: string
	description: string | null
	definition: WorkflowDefinition | null
	createdAt: number
	updatedAt: number
}

export interface WorkflowRun {
	id: string
	workflowId: string
	status: "queued" | "running" | "success" | "failed"
	startedAt: number | null
	finishedAt: number | null
	output: unknown
}

async function throwOnError(r: Response): Promise<never> {
	const body = await r
		.json()
		.catch(() => ({ error: "Request failed" })) as { error: string }
	throw new Error(body.error ?? "Request failed")
}

export async function listWorkflows(): Promise<Workflow[]> {
	const r = await fetch("/api/v1/workflows")
	if (!r.ok) await throwOnError(r)
	return r.json() as Promise<Workflow[]>
}

export async function getWorkflow(id: string): Promise<Workflow> {
	const r = await fetch(`/api/v1/workflows/${id}`)
	if (!r.ok) await throwOnError(r)
	return r.json() as Promise<Workflow>
}

export async function createWorkflow(data: {
	name: string
	description?: string
	definition?: WorkflowDefinition
}): Promise<Workflow> {
	const r = await fetch("/api/v1/workflows", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	})
	if (!r.ok) await throwOnError(r)
	return r.json() as Promise<Workflow>
}

export async function updateWorkflow(
	id: string,
	data: {
		name?: string
		description?: string
		definition?: WorkflowDefinition
	},
): Promise<Workflow> {
	const r = await fetch(`/api/v1/workflows/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	})
	if (!r.ok) await throwOnError(r)
	return r.json() as Promise<Workflow>
}

export async function deleteWorkflow(id: string): Promise<void> {
	const r = await fetch(`/api/v1/workflows/${id}`, { method: "DELETE" })
	if (!r.ok) await throwOnError(r)
}

export async function triggerRun(id: string): Promise<WorkflowRun> {
	const r = await fetch(`/api/v1/workflows/${id}/run`, { method: "POST" })
	if (!r.ok) await throwOnError(r)
	return r.json() as Promise<WorkflowRun>
}

export async function listRuns(workflowId: string): Promise<WorkflowRun[]> {
	const r = await fetch(`/api/v1/workflows/${workflowId}/runs`)
	if (!r.ok) await throwOnError(r)
	return r.json() as Promise<WorkflowRun[]>
}

/**
 * Ask the AI to generate a WorkflowDefinition from a natural-language prompt.
 * Returns the suggested definition — does NOT save it automatically.
 */
export async function aiGenerateWorkflow(
	workflowId: string,
	prompt: string,
	options?: { provider?: string; model?: string },
): Promise<WorkflowDefinition> {
	const r = await fetch(`/api/v1/workflows/${workflowId}/ai-generate`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ prompt, ...options }),
	})
	if (!r.ok) await throwOnError(r)
	return r.json() as Promise<WorkflowDefinition>
}
