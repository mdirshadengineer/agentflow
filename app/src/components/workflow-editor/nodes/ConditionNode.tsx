import { Handle, type Node, type NodeProps, Position } from "@xyflow/react"
import { GitBranchIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ConditionNodeData } from "@/types/workflow"

export function ConditionNode({
	data,
	selected,
}: NodeProps<Node<ConditionNodeData>>) {
	return (
		<div
			className={cn(
				"min-w-40 rounded-lg border bg-card shadow-sm overflow-visible",
				selected && "ring-2 ring-primary animate-node-select"
			)}
		>
			<div className="flex items-center gap-1.5 bg-amber-500/10 border-b px-3 py-1.5 rounded-t-lg">
				<GitBranchIcon className="size-3 text-amber-600 shrink-0" />
				<span className="text-xs font-medium text-amber-700 dark:text-amber-400 truncate">
					{data.label}
				</span>
			</div>
			<div className="px-3 py-2">
				<code className="text-[10px] text-muted-foreground break-all">
					{data.condition || "Enter condition…"}
				</code>
			</div>
			<Handle type="target" position={Position.Top} />
			{/* true branch */}
			<Handle
				type="source"
				position={Position.Bottom}
				id="true"
				style={{ left: "30%" }}
			/>
			{/* false branch */}
			<Handle
				type="source"
				position={Position.Bottom}
				id="false"
				style={{ left: "70%" }}
			/>
			{/* Branch labels sit outside the card below the handles */}
			<div
				className="absolute left-0 right-0 flex justify-between px-3 text-[9px] text-muted-foreground"
				style={{ top: "100%", marginTop: "6px", pointerEvents: "none" }}
			>
				<span className="text-green-600 font-medium">true</span>
				<span className="text-red-500 font-medium">false</span>
			</div>
		</div>
	)
}
