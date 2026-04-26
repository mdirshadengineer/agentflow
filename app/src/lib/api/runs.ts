// ── Typed API helpers for /api/v1/runs ───────────────────────────────────────
// This is the ONLY module that knows the /api/v1/runs URL prefix.

export interface Run {
	id: string
	workflowId: string
	status: "queued" | "running" | "success" | "failed"
	startedAt: number | null
	finishedAt: number | null
	output: unknown
}

export interface RunStep {
	id: string
	runId: string
	stepName: string
	status: string
	logs: string | null
	startedAt: number | null
	finishedAt: number | null
}

export interface RunDetail extends Run {
	steps: RunStep[]
}

async function throwOnError(r: Response): Promise<never> {
	const body = await r
		.json()
		.catch(() => ({ error: "Request failed" })) as { error: string }
	throw new Error(body.error ?? "Request failed")
}

export async function listRecentRuns(): Promise<Run[]> {
	const r = await fetch("/api/v1/runs")
	if (!r.ok) await throwOnError(r)
	return r.json() as Promise<Run[]>
}

export async function getRun(id: string): Promise<RunDetail> {
	const r = await fetch(`/api/v1/runs/${id}`)
	if (!r.ok) await throwOnError(r)
	return r.json() as Promise<RunDetail>
}
