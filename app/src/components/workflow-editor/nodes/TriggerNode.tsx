import { Handle, Position, type NodeProps } from "@xyflow/react"
import { ZapIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { TriggerNodeData } from "@/types/workflow"

const TRIGGER_LABELS: Record<string, string> = {
	manual: "Manual",
	scheduled: "Scheduled",
	webhook: "Webhook",
}

export function TriggerNode({
	data,
	selected,
}: NodeProps<{ data: TriggerNodeData }>) {
	const triggerLabel = TRIGGER_LABELS[data.triggerType] ?? data.triggerType
	return (
		<div
			className={cn(
				"min-w-36 rounded-lg border bg-card shadow-sm overflow-hidden",
				selected && "ring-2 ring-primary",
			)}
		>
			<div className="flex items-center gap-1.5 bg-green-500/10 border-b px-3 py-1.5">
				<ZapIcon className="size-3 text-green-600 shrink-0" />
				<span className="text-xs font-medium text-green-700 dark:text-green-400 truncate">
					{data.label}
				</span>
			</div>
			<div className="px-3 py-2 space-y-1">
				<Badge variant="outline" className="text-xs">
					{triggerLabel}
				</Badge>
				{data.cron && (
					<p className="text-[10px] text-muted-foreground font-mono">
						{data.cron}
					</p>
				)}
				{data.webhookPath && (
					<p className="text-[10px] text-muted-foreground font-mono truncate">
						{data.webhookPath}
					</p>
				)}
			</div>
			{/* Only source handle — trigger has no inputs */}
			<Handle type="source" position={Position.Bottom} />
		</div>
	)
}
