import { Handle, Position, type NodeProps } from "@xyflow/react"
import { FlagIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { OutputNodeData } from "@/types/workflow"

export function OutputNode({
	data,
	selected,
}: NodeProps<{ data: OutputNodeData }>) {
	return (
		<div
			className={cn(
				"min-w-36 rounded-lg border bg-card shadow-sm overflow-hidden",
				selected && "ring-2 ring-primary",
			)}
		>
			<div className="flex items-center gap-1.5 bg-purple-500/10 border-b px-3 py-1.5">
				<FlagIcon className="size-3 text-purple-600 shrink-0" />
				<span className="text-xs font-medium text-purple-700 dark:text-purple-400 truncate">
					{data.label}
				</span>
			</div>
			{data.outputKey && (
				<div className="px-3 py-2">
					<code className="text-[10px] text-muted-foreground">
						key: {data.outputKey}
					</code>
				</div>
			)}
			{/* Only target handle — output is a terminal node */}
			<Handle type="target" position={Position.Top} />
		</div>
	)
}
