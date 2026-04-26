import { Handle, type NodeProps, Position } from "@xyflow/react"
import { Zap } from "lucide-react"
import type { NodeStatus } from "./BaseNode"
import { BaseNode } from "./BaseNode"

export type TriggerNodeData = {
	label?: string
	triggerType?: "manual" | "webhook" | "schedule"
	description?: string
	status?: NodeStatus
}

export function TriggerNode({ data, selected }: NodeProps) {
	const d = data as TriggerNodeData
	const triggerLabels = {
		manual: "Manual",
		webhook: "Webhook",
		schedule: "Schedule",
	}
	const badge = d.triggerType ? triggerLabels[d.triggerType] : "Manual"

	return (
		<>
			<BaseNode
				selected={selected}
				status={d.status ?? "idle"}
				icon={<Zap className="size-3.5 text-yellow-400" />}
				label={d.label ?? "Trigger"}
				description={d.description}
				badge={badge}
				badgeColor="bg-yellow-400/10 text-yellow-300"
			/>
			{/* source handle at bottom */}
			<Handle type="source" position={Position.Bottom} id="out" />
		</>
	)
}
