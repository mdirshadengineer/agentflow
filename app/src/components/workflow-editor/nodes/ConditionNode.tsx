import { Handle, type NodeProps, Position } from "@xyflow/react"
import { GitBranch } from "lucide-react"
import type { NodeStatus } from "./BaseNode"
import { BaseNode } from "./BaseNode"

export type ConditionNodeData = {
	label?: string
	condition?: string
	description?: string
	status?: NodeStatus
}

export function ConditionNode({ data, selected }: NodeProps) {
	const d = data as ConditionNodeData

	return (
		<>
			<Handle type="target" position={Position.Top} id="in" />
			<BaseNode
				selected={selected}
				status={d.status ?? "idle"}
				icon={<GitBranch className="size-3.5 text-orange-400" />}
				label={d.label ?? "Condition"}
				description={d.condition ?? d.description}
				badge="if/else"
				badgeColor="bg-orange-400/10 text-orange-300"
			>
				<div className="mt-1 flex justify-between text-[10px] text-neutral-500">
					<span className="text-green-400">true ↙</span>
					<span className="text-red-400">↘ false</span>
				</div>
			</BaseNode>
			{/* true branch — bottom-left */}
			<Handle
				type="source"
				position={Position.Bottom}
				id="true"
				style={{ left: "30%" }}
			/>
			{/* false branch — bottom-right */}
			<Handle
				type="source"
				position={Position.Bottom}
				id="false"
				style={{ left: "70%" }}
			/>
		</>
	)
}
