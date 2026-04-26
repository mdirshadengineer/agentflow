import { Bot, GitBranch, Play, Send, Zap } from "lucide-react"
import type { DragEvent } from "react"
import type { WorkflowNodeType } from "@/hooks/use-workflow"
import { cn } from "@/lib/utils"

interface NodeCategory {
	type: WorkflowNodeType
	label: string
	icon: React.ReactNode
	description: string
	color: string
}

const NODE_CATEGORIES: NodeCategory[] = [
	{
		type: "trigger",
		label: "Trigger",
		icon: <Zap className="size-4" />,
		description: "Start your workflow",
		color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
	},
	{
		type: "action",
		label: "Action",
		icon: <Play className="size-4" />,
		description: "HTTP, script, transform",
		color: "text-sky-400 border-sky-400/30 bg-sky-400/5",
	},
	{
		type: "agent",
		label: "Agent",
		icon: <Bot className="size-4" />,
		description: "AI agent invocation",
		color: "text-violet-400 border-violet-400/30 bg-violet-400/5",
	},
	{
		type: "condition",
		label: "Condition",
		icon: <GitBranch className="size-4" />,
		description: "Branch on if/else",
		color: "text-orange-400 border-orange-400/30 bg-orange-400/5",
	},
	{
		type: "output",
		label: "Output",
		icon: <Send className="size-4" />,
		description: "Email, file, webhook",
		color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5",
	},
]

interface NodePanelProps {
	className?: string
}

export function NodePanel({ className }: NodePanelProps) {
	const onDragStart = (
		e: DragEvent<HTMLDivElement>,
		type: WorkflowNodeType
	) => {
		e.dataTransfer.setData("application/workflow-node-type", type)
		e.dataTransfer.effectAllowed = "copy"
	}

	return (
		<div
			className={cn(
				"flex flex-col gap-2 overflow-y-auto border-neutral-700 border-r bg-neutral-900 p-3",
				className
			)}
		>
			<p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
				Node Types
			</p>
			{NODE_CATEGORIES.map((cat) => (
				<div
					key={cat.type}
					draggable
					onDragStart={(e) => onDragStart(e, cat.type)}
					className={cn(
						"flex cursor-grab items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors select-none active:cursor-grabbing hover:brightness-110",
						cat.color
					)}
				>
					{cat.icon}
					<div className="min-w-0">
						<p className="text-xs font-medium leading-none">{cat.label}</p>
						<p className="mt-0.5 truncate text-[10px] text-neutral-500">
							{cat.description}
						</p>
					</div>
				</div>
			))}
			<div className="mt-3 rounded-lg border border-neutral-700 border-dashed p-2.5 text-center text-[10px] text-neutral-600">
				Drag nodes onto the canvas
			</div>
		</div>
	)
}
