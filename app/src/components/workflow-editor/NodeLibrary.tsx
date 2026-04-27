import type { DragEvent } from "react"
import {
	BotIcon,
	FlagIcon,
	GitBranchIcon,
	ZapIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { WorkflowNodeType } from "@/types/workflow"

interface NodeTypeConfig {
	type: WorkflowNodeType
	label: string
	description: string
	icon: React.ElementType
	colorClass: string
}

const NODE_TYPES: NodeTypeConfig[] = [
	{
		type: "trigger",
		label: "Trigger",
		description: "Start the workflow",
		icon: ZapIcon,
		colorClass: "text-green-600 bg-green-500/10 border-green-500/30",
	},
	{
		type: "agent",
		label: "Agent",
		description: "Run an AI agent",
		icon: BotIcon,
		colorClass: "text-blue-600 bg-blue-500/10 border-blue-500/30",
	},
	{
		type: "condition",
		label: "Condition",
		description: "Branch on a condition",
		icon: GitBranchIcon,
		colorClass: "text-amber-600 bg-amber-500/10 border-amber-500/30",
	},
	{
		type: "output",
		label: "Output",
		description: "Collect final output",
		icon: FlagIcon,
		colorClass: "text-purple-600 bg-purple-500/10 border-purple-500/30",
	},
]

interface NodeLibraryProps {
	className?: string
}

export function NodeLibrary({ className }: NodeLibraryProps) {
	const onDragStart = (e: DragEvent<HTMLDivElement>, nodeType: WorkflowNodeType) => {
		e.dataTransfer.setData("application/agentflow-node-type", nodeType)
		e.dataTransfer.effectAllowed = "move"
	}

	return (
		<aside
			className={cn(
				"flex flex-col gap-2 w-52 shrink-0 border-r bg-background p-3 overflow-y-auto",
				className,
			)}
		>
			<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
				Nodes
			</p>
			{NODE_TYPES.map(({ type, label, description, icon: Icon, colorClass }) => (
				<div
					key={type}
					draggable
					onDragStart={(e) => onDragStart(e, type)}
					className={cn(
						"flex items-start gap-2 rounded-lg border p-2.5 cursor-grab active:cursor-grabbing select-none",
						"hover:bg-accent transition-colors",
						colorClass,
					)}
				>
					<Icon className="size-3.5 shrink-0 mt-0.5" />
					<div>
						<p className="text-xs font-medium">{label}</p>
						<p className="text-[10px] text-muted-foreground">{description}</p>
					</div>
				</div>
			))}
			<p className="text-[10px] text-muted-foreground mt-2">
				Drag nodes onto the canvas to build your workflow.
			</p>
		</aside>
	)
}
