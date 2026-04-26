import { Handle, type NodeProps, Position } from "@xyflow/react"
import { Play } from "lucide-react"
import type { NodeStatus } from "./BaseNode"
import { BaseNode } from "./BaseNode"

export type ActionNodeData = {
	label?: string
	actionType?: "http" | "script" | "transform"
	description?: string
	status?: NodeStatus
}

export function ActionNode({ data, selected }: NodeProps) {
	const d = data as ActionNodeData
	const actionLabels = {
		http: "HTTP",
		script: "Script",
		transform: "Transform",
	}
	const badge = d.actionType ? actionLabels[d.actionType] : "Action"

	return (
		<>
			<Handle type="target" position={Position.Top} id="in" />
			<BaseNode
				selected={selected}
				status={d.status ?? "idle"}
				icon={<Play className="size-3.5 text-sky-400" />}
				label={d.label ?? "Action"}
				description={d.description}
				badge={badge}
				badgeColor="bg-sky-400/10 text-sky-300"
			/>
			<Handle type="source" position={Position.Bottom} id="out" />
		</>
	)
}
