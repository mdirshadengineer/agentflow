export interface NodeManifest {
	type: string
	label: string
	description: string
	category?: string
	configSchema: {
		type: string
		properties: Record<
			string,
			{
				type: string
				description?: string
				default?: unknown
				enum?: string[]
				minimum?: number
			}
		>
		required?: string[]
	}
	outputSchema: unknown
}

export async function listNodes(): Promise<NodeManifest[]> {
	const r = await fetch("/api/v1/nodes")
	if (!r.ok) throw new Error("Failed to fetch nodes")
	return r.json() as Promise<NodeManifest[]>
}
