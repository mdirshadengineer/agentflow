import { useEffect, useRef, useState } from "react"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"
import { listAgents, type Agent } from "@/lib/api/agents"
import { listNodes, type NodeManifest } from "@/lib/api/nodes"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import type { WorkflowNode } from "@/types/workflow"

interface NodeConfigPanelProps {
	node: WorkflowNode
	onUpdate: (data: Record<string, unknown>) => void
	allNodes?: WorkflowNode[]
}

export function NodeConfigPanel({ node, onUpdate, allNodes }: NodeConfigPanelProps) {
	const [agents, setAgents] = useState<Agent[]>([])
	const [manifests, setManifests] = useState<NodeManifest[]>([])

	useEffect(() => {
		listAgents()
			.then(setAgents)
			.catch(() => {
				// Agents are optional — silently ignore if API is unavailable
			})
	}, [])

	useEffect(() => {
		listNodes()
			.then(setManifests)
			.catch(() => {
				// Manifests are optional — silently ignore
			})
	}, [])

	// For generic nodes, the actual manifest type is stored in data.nodeType
	const manifestType =
		node.type === "generic"
			? (node.data as { nodeType?: string }).nodeType ?? node.type
			: node.type
	const manifest = manifests.find((m) => m.type === manifestType)

	// Determine which config UI to render
	const isBuiltIn =
		node.type === "trigger" ||
		node.type === "agent" ||
		node.type === "condition" ||
		node.type === "output"

	return (
		<aside className="w-64 shrink-0 border-l bg-background overflow-y-auto">
			<div className="p-3 border-b">
				<p className="text-xs font-semibold">
					{node.type.charAt(0).toUpperCase() + node.type.slice(1)} Node
				</p>
				<p className="text-[10px] text-muted-foreground">Configure this node</p>
			</div>
			<div className="p-3">
				<FieldGroup>
					<Field>
						<FieldLabel>Label</FieldLabel>
						<Input
							value={(node.data as { label?: string }).label ?? ""}
							onChange={(e) => onUpdate({ label: e.target.value })}
							className="h-7 text-xs"
						/>
					</Field>

					{node.type === "trigger" && <TriggerConfig node={node} onUpdate={onUpdate} />}
					{node.type === "agent" && (
						<AgentConfig node={node} agents={agents} onUpdate={onUpdate} />
					)}
					{node.type === "condition" && (
						<ConditionConfig node={node} onUpdate={onUpdate} allNodes={allNodes} />
					)}
					{node.type === "output" && <OutputConfig node={node} onUpdate={onUpdate} />}
					{!isBuiltIn && (
						<SchemaForm
							schema={manifest?.configSchema ?? { type: "object", properties: {} }}
							data={node.data as Record<string, unknown>}
							onUpdate={onUpdate}
						/>
					)}
				</FieldGroup>
			</div>
		</aside>
	)
}

// ── Schema-driven form ────────────────────────────────────────────────────────

const MULTILINE_KEYWORDS = ["body", "prompt", "expression", "content", "message", "description"]

function isMultiline(key: string, description = ""): boolean {
	const combined = (key + " " + description).toLowerCase()
	return MULTILINE_KEYWORDS.some((kw) => combined.includes(kw))
}

function SchemaForm({
	schema,
	data,
	onUpdate,
}: {
	schema: NodeManifest["configSchema"]
	data: Record<string, unknown>
	onUpdate: (d: Record<string, unknown>) => void
}) {
	const entries = Object.entries(schema.properties ?? {})
	if (entries.length === 0) return null

	return (
		<>
			{entries.map(([key, prop]) => {
				const value = data[key]

				if (prop.enum) {
					return (
						<Field key={key}>
							<FieldLabel>{key}</FieldLabel>
							<Select
								value={String(value ?? prop.default ?? "")}
								onValueChange={(v) => onUpdate({ [key]: v })}
							>
								<SelectTrigger className="h-7 text-xs w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{prop.enum.map((opt) => (
										<SelectItem key={opt} value={opt}>
											{opt}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{prop.description && (
								<p className="text-[10px] text-muted-foreground">{prop.description}</p>
							)}
						</Field>
					)
				}

				if (prop.type === "boolean") {
					return (
						<Field key={key}>
							<div className="flex items-center gap-2">
								<input
									type="checkbox"
									id={`schema-${key}`}
									checked={Boolean(value ?? prop.default ?? false)}
									onChange={(e) => onUpdate({ [key]: e.target.checked })}
									className="size-3.5 rounded border"
								/>
								<FieldLabel htmlFor={`schema-${key}`}>{key}</FieldLabel>
							</div>
							{prop.description && (
								<p className="text-[10px] text-muted-foreground">{prop.description}</p>
							)}
						</Field>
					)
				}

				if (prop.type === "number") {
					return (
						<Field key={key}>
							<FieldLabel>{key}</FieldLabel>
							<Input
								type="number"
								min={prop.minimum}
								value={String(value ?? prop.default ?? "")}
								onChange={(e) => {
									const n = e.target.valueAsNumber
									onUpdate({ [key]: Number.isFinite(n) ? n : undefined })
								}}
								className="h-7 text-xs"
							/>
							{prop.description && (
								<p className="text-[10px] text-muted-foreground">{prop.description}</p>
							)}
						</Field>
					)
				}

				if (prop.type === "object") {
					return (
						<Field key={key}>
							<FieldLabel>{key}</FieldLabel>
							<Textarea
								value={
									typeof value === "string"
										? value
										: JSON.stringify(value ?? prop.default ?? {}, null, 2)
								}
								onChange={(e) => {
									try {
										onUpdate({ [key]: JSON.parse(e.target.value) })
									} catch {
										onUpdate({ [key]: e.target.value })
									}
								}}
								rows={4}
								className="text-xs font-mono"
							/>
							{prop.description && (
								<p className="text-[10px] text-muted-foreground">{prop.description}</p>
							)}
						</Field>
					)
				}

				// string type
				if (isMultiline(key, prop.description)) {
					return (
						<Field key={key}>
							<FieldLabel>{key}</FieldLabel>
							<Textarea
								value={String(value ?? prop.default ?? "")}
								onChange={(e) => onUpdate({ [key]: e.target.value })}
								rows={4}
								className="text-xs"
							/>
							{prop.description && (
								<p className="text-[10px] text-muted-foreground">{prop.description}</p>
							)}
						</Field>
					)
				}

				return (
					<Field key={key}>
						<FieldLabel>{key}</FieldLabel>
						<Input
							value={String(value ?? prop.default ?? "")}
							onChange={(e) => onUpdate({ [key]: e.target.value })}
							className="h-7 text-xs"
						/>
						{prop.description && (
							<p className="text-[10px] text-muted-foreground">{prop.description}</p>
						)}
					</Field>
				)
			})}
		</>
	)
}

// ── Built-in node configs ─────────────────────────────────────────────────────

function TriggerConfig({
	node,
	onUpdate,
}: { node: WorkflowNode; onUpdate: (d: Record<string, unknown>) => void }) {
	const d = node.data as { triggerType?: string; cron?: string; webhookPath?: string }
	return (
		<>
			<Field>
				<FieldLabel>Trigger Type</FieldLabel>
				<Select
					value={d.triggerType ?? "manual"}
					onValueChange={(v) => onUpdate({ triggerType: v })}
				>
					<SelectTrigger className="h-7 text-xs w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="manual">Manual</SelectItem>
						<SelectItem value="scheduled">Scheduled</SelectItem>
						<SelectItem value="webhook">Webhook</SelectItem>
					</SelectContent>
				</Select>
			</Field>
			{d.triggerType === "scheduled" && (
				<Field>
					<FieldLabel>Cron Expression</FieldLabel>
					<Input
						value={d.cron ?? ""}
						onChange={(e) => onUpdate({ cron: e.target.value })}
						placeholder="0 * * * *"
						className="h-7 text-xs font-mono"
					/>
				</Field>
			)}
			{d.triggerType === "webhook" && (
				<Field>
					<FieldLabel>Webhook Path</FieldLabel>
					<Input
						value={d.webhookPath ?? ""}
						onChange={(e) => onUpdate({ webhookPath: e.target.value })}
						placeholder="/my-webhook"
						className="h-7 text-xs"
					/>
				</Field>
			)}
		</>
	)
}

function AgentConfig({
	node,
	agents,
	onUpdate,
}: {
	node: WorkflowNode
	agents: Agent[]
	onUpdate: (d: Record<string, unknown>) => void
}) {
	const d = node.data as { agentId?: string; prompt?: string }
	return (
		<>
			<Field>
				<FieldLabel>Agent</FieldLabel>
				<Select
					value={d.agentId ?? ""}
					onValueChange={(v) => {
						const agent = agents.find((a) => a.id === v)
						onUpdate({ agentId: v, agentName: agent?.name })
					}}
				>
					<SelectTrigger className="h-7 text-xs w-full">
						<SelectValue placeholder="Select agent…" />
					</SelectTrigger>
					<SelectContent>
						{agents.map((a) => (
							<SelectItem key={a.id} value={a.id}>
								{a.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
			<Field>
				<FieldLabel>Prompt Override</FieldLabel>
				<Textarea
					value={d.prompt ?? ""}
					onChange={(e) => onUpdate({ prompt: e.target.value })}
					placeholder="Optional prompt…"
					rows={4}
					className="text-xs"
				/>
			</Field>
		</>
	)
}

function ConditionConfig({
	node,
	onUpdate,
	allNodes,
}: {
	node: WorkflowNode
	onUpdate: (d: Record<string, unknown>) => void
	allNodes?: WorkflowNode[]
}) {
	const d = node.data as { condition?: string }
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const [varsOpen, setVarsOpen] = useState(false)

	const upstreamNodes = (allNodes ?? []).filter((n) => n.id !== node.id)

	const insertVariable = (variable: string) => {
		const ta = textareaRef.current
		if (ta) {
			const start = ta.selectionStart ?? 0
			const end = ta.selectionEnd ?? 0
			const current = d.condition ?? ""
			const updated = current.slice(0, start) + variable + current.slice(end)
			onUpdate({ condition: updated })
			// Restore cursor after React re-render
			requestAnimationFrame(() => {
				ta.selectionStart = start + variable.length
				ta.selectionEnd = start + variable.length
				ta.focus()
			})
		} else {
			const current = d.condition ?? ""
			onUpdate({ condition: current ? `${current} ${variable}` : variable })
		}
	}

	return (
		<>
			<Field>
				<FieldLabel>Condition Expression</FieldLabel>
				<Textarea
					ref={textareaRef}
					value={d.condition ?? ""}
					onChange={(e) => onUpdate({ condition: e.target.value })}
					placeholder="output.status === 'approved'"
					rows={3}
					className="text-xs font-mono"
				/>
				<p className="text-[10px] text-muted-foreground">
					JS expression evaluated against{" "}
					<code className="font-mono">{"{ output }"}</code>. Returns true/false.
				</p>
			</Field>

			{upstreamNodes.length > 0 && (
				<Collapsible open={varsOpen} onOpenChange={setVarsOpen}>
					<CollapsibleTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="h-6 w-full justify-start px-0 text-[10px] text-muted-foreground hover:text-foreground"
						>
							{varsOpen ? (
								<ChevronDownIcon className="size-3 mr-1" />
							) : (
								<ChevronRightIcon className="size-3 mr-1" />
							)}
							Available variables
						</Button>
					</CollapsibleTrigger>
					<CollapsibleContent className="space-y-1 pt-1">
						{upstreamNodes.map((n) => {
							const nodeLabel =
								(n.data as { label?: string }).label ?? n.id.slice(0, 6)
							const variable = `{{ steps.${nodeLabel}.output }}`
							return (
								<button
									key={n.id}
									type="button"
									onClick={() => insertVariable(variable)}
									className="block w-full text-left rounded px-2 py-1 text-[10px] font-mono bg-muted hover:bg-accent transition-colors truncate"
									title={`Insert ${variable}`}
								>
									{variable}
								</button>
							)
						})}
					</CollapsibleContent>
				</Collapsible>
			)}
		</>
	)
}

function OutputConfig({
	node,
	onUpdate,
}: { node: WorkflowNode; onUpdate: (d: Record<string, unknown>) => void }) {
	const d = node.data as { outputKey?: string }
	return (
		<Field>
			<FieldLabel>Output Key</FieldLabel>
			<Input
				value={d.outputKey ?? ""}
				onChange={(e) => onUpdate({ outputKey: e.target.value })}
				placeholder="result"
				className="h-7 text-xs"
			/>
		</Field>
	)
}
