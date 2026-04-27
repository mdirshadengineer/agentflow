import { type DragEvent, useEffect, useState } from "react"
import {
	BotIcon,
	BoxIcon,
	CircleIcon,
	ClockIcon,
	FlagIcon,
	GitBranchIcon,
	GlobeIcon,
	ScrollIcon,
	ZapIcon,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { listNodes } from "@/lib/api/nodes"

interface NodeTypeConfig {
	type: string
	label: string
	description: string
	icon: React.ElementType
	colorClass: string
}

const FALLBACK_NODES: NodeTypeConfig[] = [
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

function iconForType(type: string): React.ElementType {
	switch (type) {
		case "trigger": return ZapIcon
		case "agent":
		case "llm-agent": return BotIcon
		case "condition": return GitBranchIcon
		case "output": return FlagIcon
		case "http-request": return GlobeIcon
		case "delay": return ClockIcon
		case "log": return ScrollIcon
		case "noop": return CircleIcon
		default: return BoxIcon
	}
}

function colorForType(type: string): string {
	switch (type) {
		case "trigger": return "text-green-600 bg-green-500/10 border-green-500/30"
		case "agent":
		case "llm-agent": return "text-blue-600 bg-blue-500/10 border-blue-500/30"
		case "condition": return "text-amber-600 bg-amber-500/10 border-amber-500/30"
		case "output": return "text-purple-600 bg-purple-500/10 border-purple-500/30"
		case "http-request": return "text-cyan-600 bg-cyan-500/10 border-cyan-500/30"
		case "delay": return "text-orange-600 bg-orange-500/10 border-orange-500/30"
		case "log": return "text-slate-600 bg-slate-500/10 border-slate-500/30"
		case "noop": return "text-gray-600 bg-gray-500/10 border-gray-500/30"
		default: return "text-gray-600 bg-gray-500/10 border-gray-500/30"
	}
}

interface NodeLibraryProps {
	className?: string
}

export function NodeLibrary({ className }: NodeLibraryProps) {
	const [nodes, setNodes] = useState<NodeTypeConfig[] | null>(null)
	const [fetchError, setFetchError] = useState(false)

	useEffect(() => {
		listNodes()
			.then((manifests) => {
				setNodes(
					manifests.map((m) => ({
						type: m.type,
						label: m.label,
						description: m.description,
						icon: iconForType(m.type),
						colorClass: colorForType(m.type),
					})),
				)
			})
			.catch(() => {
				setFetchError(true)
				setNodes(FALLBACK_NODES)
			})
	}, [])

	const onDragStart = (e: DragEvent<HTMLDivElement>, nodeType: string) => {
		e.dataTransfer.setData("application/agentflow-node-type", nodeType)
		e.dataTransfer.effectAllowed = "move"
	}

	const displayNodes = nodes ?? FALLBACK_NODES

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
			{nodes === null ? (
				<>
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-12 w-full" />
				</>
			) : (
				displayNodes.map(({ type, label, description, icon: Icon, colorClass }) => (
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
				))
			)}
			{fetchError && (
				<p className="text-[10px] text-destructive">
					Could not load nodes from server — showing defaults.
				</p>
			)}
			<p className="text-[10px] text-muted-foreground mt-2">
				Drag nodes onto the canvas to build your workflow.
			</p>
		</aside>
	)
}
