// ── Typed API helpers for /api/v1/agents ─────────────────────────────────────
// This is the ONLY module that knows the /api/v1/agents URL prefix.

export interface Agent {
	id: string
	name: string
	description: string | null
	type: string
	config: unknown
	llmProvider: string | null
	llmModel: string | null
	systemPrompt: string | null
	tools: string[] | null
	createdAt: number
	updatedAt: number
}

async function throwOnError(r: Response): Promise<never> {
	const body = await r
		.json()
		.catch(() => ({ error: "Request failed" })) as { error: string }
	throw new Error(body.error ?? "Request failed")
}

export async function listAgents(): Promise<Agent[]> {
	const r = await fetch("/api/v1/agents")
	if (!r.ok) await throwOnError(r)
	return r.json() as Promise<Agent[]>
}

export async function getAgent(id: string): Promise<Agent> {
	const r = await fetch(`/api/v1/agents/${id}`)
	if (!r.ok) await throwOnError(r)
	return r.json() as Promise<Agent>
}

export async function createAgent(data: {
	name: string
	type: string
	description?: string
	config?: unknown
}): Promise<Agent> {
	const r = await fetch("/api/v1/agents", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	})
	if (!r.ok) await throwOnError(r)
	return r.json() as Promise<Agent>
}

export async function updateAgent(
	id: string,
	data: {
		name?: string
		type?: string
		description?: string
		config?: unknown
		llmProvider?: string | null
		llmModel?: string | null
		systemPrompt?: string | null
		tools?: string[] | null
	},
): Promise<Agent> {
	const r = await fetch(`/api/v1/agents/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	})
	if (!r.ok) await throwOnError(r)
	return r.json() as Promise<Agent>
}

export async function deleteAgent(id: string): Promise<void> {
	const r = await fetch(`/api/v1/agents/${id}`, { method: "DELETE" })
	if (!r.ok) await throwOnError(r)
}
