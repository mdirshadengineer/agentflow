export interface NodePropertySchema {
	type: string
	description?: string
	default?: unknown
	enum?: string[]
	minimum?: number
	/** Custom field type hint: "password" masks input; "code" uses monospace editor. */
	"x-field-type"?: "password" | "code"
}

export interface NodeManifest {
	type: string
	label: string
	description: string
	category?: string
	configSchema: {
		type: string
		properties: Record<string, NodePropertySchema>
		required?: string[]
	}
	outputSchema: unknown
}

export async function listNodes(): Promise<NodeManifest[]> {
	const r = await fetch("/api/v1/nodes")
	if (!r.ok) throw new Error("Failed to fetch nodes")
	return r.json() as Promise<NodeManifest[]>
}
