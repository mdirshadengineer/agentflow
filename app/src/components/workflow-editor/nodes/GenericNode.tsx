import { Handle, Position, type NodeProps } from "@xyflow/react"
import { BoxIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface GenericNodeData extends Record<string, unknown> {
	label?: string
	nodeType?: string
}

export function GenericNode({
	data,
	selected,
}: NodeProps<{ data: GenericNodeData }>) {
	const label = data.label ?? data.nodeType ?? "Node"
	return (
		<div
			className={cn(
				"min-w-36 rounded-lg border bg-card shadow-sm overflow-hidden",
				selected && "ring-2 ring-primary",
			)}
		>
			<div className="flex items-center gap-1.5 bg-gray-500/10 border-b px-3 py-1.5">
				<BoxIcon className="size-3 text-gray-600 shrink-0" />
				<span className="text-xs font-medium text-gray-700 dark:text-gray-400 truncate">
					{label}
				</span>
			</div>
			<div className="px-3 py-2">
				<p className="text-[10px] text-muted-foreground">{data.nodeType ?? "generic"}</p>
			</div>
			<Handle type="target" position={Position.Top} />
			<Handle type="source" position={Position.Bottom} />
		</div>
	)
}
