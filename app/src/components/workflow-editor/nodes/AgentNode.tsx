import { Handle, type NodeProps, Position } from "@xyflow/react"
import { Bot } from "lucide-react"
import type { NodeStatus } from "./BaseNode"
import { BaseNode } from "./BaseNode"

export type AgentNodeData = {
	label?: string
	agentName?: string
	model?: string
	description?: string
	status?: NodeStatus
}

export function AgentNode({ data, selected }: NodeProps) {
	const d = data as AgentNodeData

	return (
		<>
			<Handle type="target" position={Position.Top} id="in" />
			<BaseNode
				selected={selected}
				status={d.status ?? "idle"}
				icon={<Bot className="size-3.5 text-violet-400" />}
				label={d.label ?? d.agentName ?? "Agent"}
				description={d.description}
				badge={d.model ?? "AI"}
				badgeColor="bg-violet-400/10 text-violet-300"
			/>
			<Handle type="source" position={Position.Bottom} id="out" />
		</>
	)
}
