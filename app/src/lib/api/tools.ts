export interface ToolInfo {
	name: string
	description: string
	inputSchema: unknown
}

export async function listTools(): Promise<ToolInfo[]> {
	const r = await fetch("/api/v1/tools")
	if (!r.ok) throw new Error("Failed to fetch tools")
	return r.json() as Promise<ToolInfo[]>
}
