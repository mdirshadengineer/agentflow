/**
 * NodeConfigForm — shared form components used by both NodeConfigPanel (sidebar)
 * and NodeConfigModal (full-screen dialog).
 */
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"
import { useState } from "react"
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
import type { Agent } from "@/lib/api/agents"
import type { NodeManifest, NodePropertySchema } from "@/lib/api/nodes"
import type { NodeTestOutput } from "@/lib/api/workflows"
import { cn } from "@/lib/utils"
import type { WorkflowNode } from "@/types/workflow"
import { VariableInput } from "./VariableInput"

// ── Utilities ─────────────────────────────────────────────────────────────────

const MULTILINE_KEYWORDS = [
	"body",
	"prompt",
	"expression",
	"content",
	"message",
	"description",
]

export function isMultiline(key: string, description = ""): boolean {
	const combined = (key + " " + description).toLowerCase()
	return MULTILINE_KEYWORDS.some((kw) => combined.includes(kw))
}

/**
 * Returns true when any field listed in `schema.required` is empty / unset
 * in `data`. Ignores internal underscore keys.
 */
export function hasMandatoryUnset(
	schema: NodeManifest["configSchema"],
	data: Record<string, unknown>
): boolean {
	if (!schema.required || schema.required.length === 0) return false
	return schema.required.some((key) => {
		const v = data[key]
		return v === undefined || v === null || v === ""
	})
}

// ── Schema-driven form ────────────────────────────────────────────────────────

interface FieldProps {
	fieldKey: string
	prop: NodePropertySchema
	value: unknown
	required: boolean
	upstreamNodes: WorkflowNode[]
	onUpdate: (patch: Record<string, unknown>) => void
}

function SchemaField({
	fieldKey,
	prop,
	value,
	required,
	upstreamNodes,
	onUpdate,
}: FieldProps) {
	const isEmpty = value === undefined || value === null || value === ""

	const label = (
		<FieldLabel>
			{fieldKey}
			{required && (
				<span
					className="ml-0.5 text-destructive font-bold"
					aria-label="required"
				>
					*
				</span>
			)}
		</FieldLabel>
	)

	const inputRingCls =
		required && isEmpty
			? "ring-1 ring-destructive focus-visible:ring-destructive"
			: ""

	if (prop.enum) {
		return (
			<Field>
				{label}
				<Select
					value={String(value ?? prop.default ?? "")}
					onValueChange={(v) => onUpdate({ [fieldKey]: v })}
				>
					<SelectTrigger className={cn("h-7 text-xs w-full", inputRingCls)}>
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
			<Field>
				<div className="flex items-center gap-2">
					<input
						type="checkbox"
						id={`schema-${fieldKey}`}
						checked={Boolean(value ?? prop.default ?? false)}
						onChange={(e) => onUpdate({ [fieldKey]: e.target.checked })}
						className="size-3.5 rounded border"
					/>
					{label}
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
			<Field>
				{label}
				<Input
					type="number"
					min={prop.minimum}
					value={String(value ?? prop.default ?? "")}
					onChange={(e) => {
						const n = e.target.valueAsNumber
						onUpdate({ [fieldKey]: Number.isFinite(n) ? n : undefined })
					}}
					className={cn("h-7 text-xs", inputRingCls)}
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
			<Field>
				{label}
				<Textarea
					value={
						typeof value === "string"
							? value
							: JSON.stringify(value ?? prop.default ?? {}, null, 2)
					}
					onChange={(e) => {
						try {
							onUpdate({ [fieldKey]: JSON.parse(e.target.value) })
						} catch {
							onUpdate({ [fieldKey]: e.target.value })
						}
					}}
					rows={4}
					className={cn("text-xs font-mono", inputRingCls)}
				/>
				{prop.description && (
					<p className="text-[10px] text-muted-foreground">
						{prop.description}
					</p>
				)}
			</Field>
		)
	}

	// x-field-type: "password"
	if (prop["x-field-type"] === "password") {
		return (
			<Field>
				{label}
				<Input
					type="password"
					value={String(value ?? prop.default ?? "")}
					onChange={(e) => onUpdate({ [fieldKey]: e.target.value })}
					className={cn("h-7 text-xs", inputRingCls)}
					autoComplete="off"
				/>
				{prop.description && (
					<p className="text-[10px] text-muted-foreground">
						{prop.description}
					</p>
				)}
			</Field>
		)
	}

	// x-field-type: "code" or multiline string
	if (
		prop["x-field-type"] === "code" ||
		isMultiline(fieldKey, prop.description)
	) {
		return (
			<Field>
				{label}
				<VariableInput
					value={String(value ?? prop.default ?? "")}
					onChange={(v) => onUpdate({ [fieldKey]: v })}
					upstreamNodes={upstreamNodes}
					multiline
					rows={4}
					className={cn(inputRingCls)}
				/>
				{prop.description && (
					<p className="text-[10px] text-muted-foreground">
						{prop.description}
					</p>
				)}
			</Field>
		)
	}

	// plain string
	return (
		<Field>
			{label}
			<VariableInput
				value={String(value ?? prop.default ?? "")}
				onChange={(v) => onUpdate({ [fieldKey]: v })}
				upstreamNodes={upstreamNodes}
				className={inputRingCls}
			/>
			{prop.description && (
				<p className="text-[10px] text-muted-foreground">{prop.description}</p>
			)}
		</Field>
	)
}

export function SchemaFormFields({
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
	const requiredSet = new Set(schema.required ?? [])

	return (
		<>
			{entries.map(([key, prop]) => (
				<SchemaField
					key={key}
					fieldKey={key}
					prop={prop}
					value={data[key]}
					required={requiredSet.has(key)}
					upstreamNodes={upstreamNodes}
					onUpdate={onUpdate}
				/>
			))}
		</>
	)
}

// ── Built-in node configs ─────────────────────────────────────────────────────

export function TriggerConfig({
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
						<SelectItem value="scheduled">Scheduled (Cron)</SelectItem>
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
					<p className="text-[10px] text-muted-foreground">
						Standard cron syntax, e.g.{" "}
						<code className="font-mono">0 9 * * 1-5</code> for weekdays at
						09:00.
					</p>
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
					<p className="text-[10px] text-muted-foreground">
						POST to{" "}
						<code className="font-mono">
							/api/v1/webhooks{d.webhookPath || "/…"}
						</code>
					</p>
				</Field>
			)}
		</>
	)
}

export function AgentConfig({
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
	const isEmpty = !d.agentId
	return (
		<>
			<Field>
				<FieldLabel>
					Agent
					<span
						className="ml-0.5 text-destructive font-bold"
						aria-label="required"
					>
						*
					</span>
				</FieldLabel>
				<Select
					value={d.agentId ?? ""}
					onValueChange={(v) => {
						const agent = agents.find((a) => a.id === v)
						onUpdate({ agentId: v, agentName: agent?.name })
					}}
				>
					<SelectTrigger
						className={cn(
							"h-7 text-xs w-full",
							isEmpty &&
								"ring-1 ring-destructive focus-visible:ring-destructive"
						)}
					>
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

export function ConditionConfig({
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
		<Field>
			<FieldLabel>
				Condition Expression
				<span
					className="ml-0.5 text-destructive font-bold"
					aria-label="required"
				>
					*
				</span>
			</FieldLabel>
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
	)
}

export function OutputConfig({
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

// ── Test result display ───────────────────────────────────────────────────────

import { CheckCircle2Icon, XCircleIcon } from "lucide-react"

export function TestResultPanel({
	testResult,
}: {
	testResult: NodeTestOutput
}) {
	const [open, setOpen] = useState(true)
	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex w-full items-center gap-1.5 px-3 py-2 text-[10px] font-semibold hover:bg-muted transition-colors",
						testResult.status === "success" ? "text-green-600" : "text-red-500"
					)}
				>
					{testResult.status === "success" ? (
						<CheckCircle2Icon className="size-3 shrink-0" />
					) : (
						<XCircleIcon className="size-3 shrink-0" />
					)}
					Step output
					{open ? (
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
	)
}

// ── Combined form body ────────────────────────────────────────────────────────

/**
 * Renders the Label field + type-appropriate config fields for any node.
 * Suitable for use in both the sidebar panel and the modal.
 */
export function NodeFormBody({
	node,
	manifest,
	agents,
	allNodes,
	onUpdate,
}: {
	node: WorkflowNode
	manifest?: NodeManifest
	agents: Agent[]
	allNodes?: WorkflowNode[]
	onUpdate: (patch: Record<string, unknown>) => void
}) {
	const isBuiltIn =
		node.type === "trigger" ||
		node.type === "agent" ||
		node.type === "condition" ||
		node.type === "output"

	const upstreamNodes = (allNodes ?? []).filter((n) => n.id !== node.id)

	return (
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
				<ConditionConfig node={node} onUpdate={onUpdate} allNodes={allNodes} />
			)}
			{node.type === "output" && (
				<OutputConfig node={node} onUpdate={onUpdate} />
			)}
			{!isBuiltIn && (
				<SchemaFormFields
					schema={manifest?.configSchema ?? { type: "object", properties: {} }}
					data={node.data as Record<string, unknown>}
					onUpdate={onUpdate}
					upstreamNodes={upstreamNodes}
				/>
			)}
		</FieldGroup>
	)
}
