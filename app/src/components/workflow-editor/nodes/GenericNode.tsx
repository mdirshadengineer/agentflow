import { Handle, type Node, type NodeProps, Position } from "@xyflow/react"
import { BoxIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface GenericNodeData extends Record<string, unknown> {
	label?: string
	nodeType?: string
}

/** Keys excluded from the config-field pill display. */
const SKIP_KEYS = new Set(["label", "nodeType"])

export function GenericNode({
	data,
	selected,
}: NodeProps<Node<GenericNodeData>>) {
	const label = data.label ?? data.nodeType ?? "Node"

	// Show up to 2 config fields as pills (skip meta keys)
	const configEntries = Object.entries(data)
		.filter(([k, v]) => !SKIP_KEYS.has(k) && v !== undefined && v !== "")
		.slice(0, 2)

	return (
		<div
			className={cn(
				"min-w-36 rounded-lg border bg-card shadow-sm overflow-hidden",
				selected && "ring-2 ring-primary animate-node-select",
			)}
		>
			<div className="flex items-center gap-1.5 bg-gray-500/10 border-b px-3 py-1.5">
				<BoxIcon className="size-3 text-gray-600 shrink-0" />
				<span className="text-xs font-medium text-gray-700 dark:text-gray-400 truncate">
					{label}
				</span>
			</div>
			<div className="px-3 py-2 space-y-1">
				<p className="text-[10px] text-muted-foreground">
					{data.nodeType ?? "generic"}
				</p>
				{configEntries.map(([k, v]) => (
					<span
						key={k}
						className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[9px] font-mono truncate max-w-full"
					>
						<span className="text-muted-foreground">{k}:</span>
						<span className="truncate">{String(v)}</span>
					</span>
				))}
			</div>
			<Handle type="target" position={Position.Top} />
			<Handle type="source" position={Position.Bottom} />
		</div>
	)
}
