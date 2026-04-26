import { Handle, Position, type NodeProps } from "@xyflow/react"
import { GitBranchIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ConditionNodeData } from "@/types/workflow"

export function ConditionNode({
	data,
	selected,
}: NodeProps<{ data: ConditionNodeData }>) {
	return (
		<div
			className={cn(
				"min-w-40 rounded-lg border bg-card shadow-sm overflow-hidden",
				selected && "ring-2 ring-primary",
			)}
		>
			<div className="flex items-center gap-1.5 bg-amber-500/10 border-b px-3 py-1.5">
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
			<div className="flex justify-between px-3 pb-1 text-[9px] text-muted-foreground">
				<span>true</span>
				<span>false</span>
			</div>
		</div>
	)
}
