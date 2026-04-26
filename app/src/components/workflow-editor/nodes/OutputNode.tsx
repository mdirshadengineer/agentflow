import { Handle, type NodeProps, Position } from "@xyflow/react"
import { Send } from "lucide-react"
import type { NodeStatus } from "./BaseNode"
import { BaseNode } from "./BaseNode"

export type OutputNodeData = {
	label?: string
	outputType?: "email" | "file" | "webhook" | "log"
	description?: string
	status?: NodeStatus
}

export function OutputNode({ data, selected }: NodeProps) {
	const d = data as OutputNodeData
	const outputLabels = {
		email: "Email",
		file: "File",
		webhook: "Webhook",
		log: "Log",
	}
	const badge = d.outputType ? outputLabels[d.outputType] : "Output"

	return (
		<>
			<Handle type="target" position={Position.Top} id="in" />
			<BaseNode
				selected={selected}
				status={d.status ?? "idle"}
				icon={<Send className="size-3.5 text-emerald-400" />}
				label={d.label ?? "Output"}
				description={d.description}
				badge={badge}
				badgeColor="bg-emerald-400/10 text-emerald-300"
			/>
		</>
	)
}
