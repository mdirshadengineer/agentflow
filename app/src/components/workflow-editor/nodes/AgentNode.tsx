import { Handle, Position, type NodeProps } from "@xyflow/react"
import { BotIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AgentNodeData } from "@/types/workflow"

export function AgentNode({
	data,
	selected,
}: NodeProps<{ data: AgentNodeData }>) {
	return (
		<div
			className={cn(
				"min-w-36 rounded-lg border bg-card shadow-sm overflow-hidden",
				selected && "ring-2 ring-primary",
			)}
		>
			<div className="flex items-center gap-1.5 bg-blue-500/10 border-b px-3 py-1.5">
				<BotIcon className="size-3 text-blue-600 shrink-0" />
				<span className="text-xs font-medium text-blue-700 dark:text-blue-400 truncate">
					{data.label}
				</span>
			</div>
			<div className="px-3 py-2 space-y-1">
				{data.agentName ? (
					<Badge variant="secondary" className="text-xs">
						{data.agentName}
					</Badge>
				) : data.agentId ? (
					<p className="text-[10px] text-muted-foreground font-mono truncate">
						{data.agentId.slice(0, 8)}…
					</p>
				) : (
					<p className="text-[10px] text-destructive">No agent selected</p>
				)}
				{data.prompt && (
					<p className="text-[10px] text-muted-foreground line-clamp-2">
						{data.prompt}
					</p>
				)}
			</div>
			<Handle type="target" position={Position.Top} />
			<Handle type="source" position={Position.Bottom} />
		</div>
	)
}
