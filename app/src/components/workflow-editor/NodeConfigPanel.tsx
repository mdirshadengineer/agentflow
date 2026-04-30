import {
	BotIcon,
	BoxIcon,
	CheckCircle2Icon,
	ChevronDownIcon,
	ChevronRightIcon,
	ChevronRightSquareIcon,
	FlagIcon,
	GitBranchIcon,
	Loader2Icon,
	PlayIcon,
	Trash2Icon,
	XCircleIcon,
	XIcon,
	ZapIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { type Agent, listAgents } from "@/lib/api/agents"
import { listNodes, type NodeManifest } from "@/lib/api/nodes"
import { type NodeTestOutput, testNode } from "@/lib/api/workflows"
import { cn } from "@/lib/utils"
import type { WorkflowNode } from "@/types/workflow"
import { VariableInput } from "./VariableInput"

const NODE_TYPE_ICONS: Record<string, React.ElementType> = {
	trigger: ZapIcon,
	agent: BotIcon,
	condition: GitBranchIcon,
	output: FlagIcon,
	generic: BoxIcon,
}

interface NodeConfigPanelProps {
	node: WorkflowNode
	onUpdate: (data: Record<string, unknown>) => void
	onClose: () => void
	onDelete: (nodeId: string) => void
	allNodes?: WorkflowNode[]
	workflowId?: string
}

export function NodeConfigPanel({
	node,
	onUpdate,
	onClose,
	onDelete,
	allNodes,
	workflowId,
}: NodeConfigPanelProps) {
	const [agents, setAgents] = useState<Agent[]>([])
	const [manifests, setManifests] = useState<NodeManifest[]>([])
	const [collapsed, setCollapsed] = useState(false)
	const [testing, setTesting] = useState(false)
	const [testResult, setTestResult] = useState<NodeTestOutput | null>(null)
	const [testResultOpen, setTestResultOpen] = useState(false)

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

	// Reset test result when node changes
	useEffect(() => {
		setTestResult(null)
		setTestResultOpen(false)
	}, [node.id])

	// For generic nodes, the actual manifest type is stored in data.nodeType
	const manifestType =
		node.type === "generic"
			? ((node.data as { nodeType?: string }).nodeType ?? node.type)
			: node.type
	const manifest = manifests.find((m) => m.type === manifestType)

	// Determine which config UI to render
	const isBuiltIn =
		node.type === "trigger" ||
		node.type === "agent" ||
		node.type === "condition" ||
		node.type === "output"

	const nodeLabel =
		(node.data as { label?: string }).label ||
		node.type.charAt(0).toUpperCase() + node.type.slice(1)

	const TypeIcon = NODE_TYPE_ICONS[node.type] ?? BoxIcon

	// Upstream nodes: all nodes except this one, for variable references
	const upstreamNodes = (allNodes ?? []).filter((n) => n.id !== node.id)

	const handleTestStep = async () => {
		if (!workflowId) return
		setTesting(true)
		setTestResult(null)
		try {
			const nodeType =
				node.type === "generic"
					? ((node.data as { nodeType?: string }).nodeType ?? "noop")
					: node.type
			const config = { ...node.data } as Record<string, unknown>
			delete config.label
			delete config.nodeType
			const result = await testNode(workflowId, nodeType, config)
			setTestResult(result)
			setTestResultOpen(true)
		} catch (err) {
			setTestResult({
				status: "failed",
				data: {},
				logs: err instanceof Error ? err.message : String(err),
			})
			setTestResultOpen(true)
		} finally {
			setTesting(false)
		}
	}

	// Collapsed strip view
	if (collapsed) {
		return (
			<aside className="w-9 shrink-0 border-l bg-background flex flex-col items-center pt-3 gap-3">
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => setCollapsed(false)}
					title="Expand panel"
				>
					<ChevronRightSquareIcon className="size-3.5" />
				</Button>
				<TypeIcon className="size-3.5 text-muted-foreground" />
			</aside>
		)
	}

	return (
		<aside className="w-64 shrink-0 border-l bg-background overflow-y-auto flex flex-col">
			<div className="p-3 border-b flex items-start justify-between gap-1">
				<div className="min-w-0">
					<p className="text-xs font-semibold truncate">{nodeLabel}</p>
					<p className="text-[10px] text-muted-foreground">
						{node.type.charAt(0).toUpperCase() + node.type.slice(1)} node
					</p>
				</div>
				<div className="flex items-center gap-0.5 shrink-0">
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={() => setCollapsed(true)}
						title="Collapse panel"
						className="size-6"
					>
						<ChevronRightIcon className="size-3" />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onClose}
						title="Close panel"
						className="size-6"
					>
						<XIcon className="size-3" />
					</Button>
				</div>
			</div>
			<div className="p-3 flex-1">
				<FieldGroup>
					<Field>
						<FieldLabel>Label</FieldLabel>
						<Input
							value={(node.data as { label?: string }).label ?? ""}
							onChange={(e) => onUpdate({ label: e.target.value })}
							className="h-7 text-xs"
						/>
					</Field>

					{node.type === "trigger" && (
						<TriggerConfig node={node} onUpdate={onUpdate} />
					)}
					{node.type === "agent" && (
						<AgentConfig
							node={node}
							agents={agents}
							onUpdate={onUpdate}
							upstreamNodes={upstreamNodes}
						/>
					)}
					{node.type === "condition" && (
						<ConditionConfig
							node={node}
							onUpdate={onUpdate}
							allNodes={allNodes}
						/>
					)}
					{node.type === "output" && (
						<OutputConfig node={node} onUpdate={onUpdate} />
					)}
					{!isBuiltIn && (
						<SchemaForm
							schema={
								manifest?.configSchema ?? { type: "object", properties: {} }
							}
							data={node.data as Record<string, unknown>}
							onUpdate={onUpdate}
							upstreamNodes={upstreamNodes}
						/>
					)}
				</FieldGroup>
			</div>

			{/* Test step result */}
			{testResult && (
				<Collapsible
					open={testResultOpen}
					onOpenChange={setTestResultOpen}
					className="border-t"
				>
					<CollapsibleTrigger asChild>
						<button
							type="button"
							className={cn(
								"flex w-full items-center gap-1.5 px-3 py-2 text-[10px] font-semibold hover:bg-muted transition-colors",
								testResult.status === "success"
									? "text-green-600"
									: "text-red-500"
							)}
						>
							{testResult.status === "success" ? (
								<CheckCircle2Icon className="size-3 shrink-0" />
							) : (
								<XCircleIcon className="size-3 shrink-0" />
							)}
							Step output
							{testResultOpen ? (
								<ChevronDownIcon className="size-3 ml-auto" />
							) : (
								<ChevronRightIcon className="size-3 ml-auto" />
							)}
						</button>
					</CollapsibleTrigger>
					<CollapsibleContent className="px-3 pb-3">
						{testResult.logs && (
							<pre className="text-[10px] text-muted-foreground font-mono whitespace-pre-wrap break-all mb-1">
								{testResult.logs}
							</pre>
						)}
						{Object.keys(testResult.data).length > 0 && (
							<pre className="text-[10px] font-mono bg-muted rounded px-2 py-1.5 whitespace-pre-wrap break-all overflow-auto max-h-40">
								{JSON.stringify(testResult.data, null, 2)}
							</pre>
						)}
					</CollapsibleContent>
				</Collapsible>
			)}

			<div className="p-3 border-t flex flex-col gap-2">
				{/* Test step button — only for generic (non-built-in trigger/output) nodes */}
				{!isBuiltIn && workflowId && (
					<Button
						variant="secondary"
						size="sm"
						className="w-full gap-1.5 text-xs"
						onClick={() => void handleTestStep()}
						disabled={testing}
					>
						{testing ? (
							<Loader2Icon className="size-3 animate-spin" />
						) : (
							<PlayIcon className="size-3" />
						)}
						{testing ? "Running…" : "Test step"}
					</Button>
				)}
				<Button
					variant="destructive"
					size="sm"
					className="w-full gap-1.5 text-xs"
					onClick={() => onDelete(node.id)}
				>
					<Trash2Icon className="size-3" />
					Delete node
				</Button>
			</div>
		</aside>
	)
}

// ── Schema-driven form ────────────────────────────────────────────────────────

const MULTILINE_KEYWORDS = [
	"body",
	"prompt",
	"expression",
	"content",
	"message",
	"description",
]

function isMultiline(key: string, description = ""): boolean {
	const combined = (key + " " + description).toLowerCase()
	return MULTILINE_KEYWORDS.some((kw) => combined.includes(kw))
}

function SchemaForm({
	schema,
	data,
	onUpdate,
	upstreamNodes = [],
}: {
	schema: NodeManifest["configSchema"]
	data: Record<string, unknown>
	onUpdate: (d: Record<string, unknown>) => void
	upstreamNodes?: WorkflowNode[]
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
								<p className="text-[10px] text-muted-foreground">
									{prop.description}
								</p>
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
								<p className="text-[10px] text-muted-foreground">
									{prop.description}
								</p>
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
								<p className="text-[10px] text-muted-foreground">
									{prop.description}
								</p>
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
								<p className="text-[10px] text-muted-foreground">
									{prop.description}
								</p>
							)}
						</Field>
					)
				}

				// string type — use VariableInput for autocomplete support
				if (isMultiline(key, prop.description)) {
					return (
						<Field key={key}>
							<FieldLabel>{key}</FieldLabel>
							<VariableInput
								value={String(value ?? prop.default ?? "")}
								onChange={(v) => onUpdate({ [key]: v })}
								upstreamNodes={upstreamNodes}
								multiline
								rows={4}
							/>
							{prop.description && (
								<p className="text-[10px] text-muted-foreground">
									{prop.description}
								</p>
							)}
						</Field>
					)
				}

				return (
					<Field key={key}>
						<FieldLabel>{key}</FieldLabel>
						<VariableInput
							value={String(value ?? prop.default ?? "")}
							onChange={(v) => onUpdate({ [key]: v })}
							upstreamNodes={upstreamNodes}
						/>
						{prop.description && (
							<p className="text-[10px] text-muted-foreground">
								{prop.description}
							</p>
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
}: {
	node: WorkflowNode
	onUpdate: (d: Record<string, unknown>) => void
}) {
	const d = node.data as {
		triggerType?: string
		cron?: string
		webhookPath?: string
	}
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
	upstreamNodes = [],
}: {
	node: WorkflowNode
	agents: Agent[]
	onUpdate: (d: Record<string, unknown>) => void
	upstreamNodes?: WorkflowNode[]
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
				<VariableInput
					value={d.prompt ?? ""}
					onChange={(v) => onUpdate({ prompt: v })}
					upstreamNodes={upstreamNodes}
					multiline
					rows={4}
					placeholder="Optional prompt… Type {{ to reference previous outputs"
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
	const upstreamNodes = (allNodes ?? []).filter((n) => n.id !== node.id)

	return (
		<>
			<Field>
				<FieldLabel>Condition Expression</FieldLabel>
				<VariableInput
					value={d.condition ?? ""}
					onChange={(v) => onUpdate({ condition: v })}
					upstreamNodes={upstreamNodes}
					multiline
					rows={3}
					placeholder="output.status === 'approved'"
					className="font-mono"
				/>
				<p className="text-[10px] text-muted-foreground">
					JS expression evaluated against{" "}
					<code className="font-mono">{"{ output }"}</code>. Returns true/false.
					Type <code className="font-mono">{"{{"}</code> to insert a variable.
				</p>
			</Field>
		</>
	)
}

function OutputConfig({
	node,
	onUpdate,
}: {
	node: WorkflowNode
	onUpdate: (d: Record<string, unknown>) => void
}) {
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
