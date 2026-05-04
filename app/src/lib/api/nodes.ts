export interface NodeFieldSchema {
	key: string
	label: string
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
		| "credential"
	required?: boolean
	allowExpressions?: boolean
	defaultValue?: unknown
	placeholder?: string
	description?: string
	enum?: Array<{ label: string; value: string }>
	validation?: {
		regex?: string
		min?: number
		max?: number
		customRuleIds?: string[]
	}
	visibleWhen?: { when: string }
	dependsOn?: string[]
	credentialType?: string
}

export interface NodeCatalogEntry {
	type: string
	version: number
	label: string
	description: string
	category: string
	icon?: string
	configSchema: {
		fields: NodeFieldSchema[]
		layout?: Array<{ section: string; fields: string[] }>
	}
	configJsonSchema: {
		type: string
		properties?: Record<string, unknown>
		required?: string[]
	}
	outputJsonSchema: unknown
	credentials?: Array<{
		name: string
		credentialType: string
		required: boolean
		scopes?: string[]
	}>
	retryable?: boolean
	idempotent?: boolean
}

export type NodeManifest = NodeCatalogEntry

export async function listNodes(): Promise<NodeCatalogEntry[]> {
	const r = await fetch("/api/v1/nodes")
	if (!r.ok) throw new Error("Failed to fetch nodes")
	return r.json() as Promise<NodeCatalogEntry[]>
}
