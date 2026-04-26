import { useEffect, useState } from "react"
import { listAgents, type Agent } from "@/lib/api/agents"
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
import type { WorkflowNode } from "@/types/workflow"

interface NodeConfigPanelProps {
	node: WorkflowNode
	onUpdate: (data: Record<string, unknown>) => void
}

export function NodeConfigPanel({ node, onUpdate }: NodeConfigPanelProps) {
	const [agents, setAgents] = useState<Agent[]>([])

	useEffect(() => {
		listAgents()
			.then(setAgents)
			.catch(() => {
				// Agents are optional — silently ignore if API is unavailable
			})
	}, [])

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
						<ConditionConfig node={node} onUpdate={onUpdate} />
					)}
					{node.type === "output" && <OutputConfig node={node} onUpdate={onUpdate} />}
				</FieldGroup>
			</div>
		</aside>
	)
}

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
}: { node: WorkflowNode; onUpdate: (d: Record<string, unknown>) => void }) {
	const d = node.data as { condition?: string }
	return (
		<Field>
			<FieldLabel>Condition Expression</FieldLabel>
			<Textarea
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
