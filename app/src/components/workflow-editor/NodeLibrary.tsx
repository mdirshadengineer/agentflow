import {
	BotIcon,
	BoxIcon,
	ChevronLeftSquareIcon,
	ChevronRightSquareIcon,
	CircleIcon,
	ClockIcon,
	FlagIcon,
	GitBranchIcon,
	GlobeIcon,
	ScrollIcon,
	ZapIcon,
} from "lucide-react"
import { type DragEvent, useEffect, useState } from "react"
import { useReactFlow } from "@xyflow/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { listNodes } from "@/lib/api/nodes"
import { cn } from "@/lib/utils"

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
		case "trigger":
			return ZapIcon
		case "agent":
		case "llm-agent":
			return BotIcon
		case "condition":
			return GitBranchIcon
		case "output":
			return FlagIcon
		case "http-request":
			return GlobeIcon
		case "delay":
			return ClockIcon
		case "log":
			return ScrollIcon
		case "noop":
			return CircleIcon
		default:
			return BoxIcon
	}
}

function colorForType(type: string): string {
	switch (type) {
		case "trigger":
			return "text-green-600 bg-green-500/10 border-green-500/30"
		case "agent":
		case "llm-agent":
			return "text-blue-600 bg-blue-500/10 border-blue-500/30"
		case "condition":
			return "text-amber-600 bg-amber-500/10 border-amber-500/30"
		case "output":
			return "text-purple-600 bg-purple-500/10 border-purple-500/30"
		case "http-request":
			return "text-cyan-600 bg-cyan-500/10 border-cyan-500/30"
		case "delay":
			return "text-orange-600 bg-orange-500/10 border-orange-500/30"
		case "log":
			return "text-slate-600 bg-slate-500/10 border-slate-500/30"
		case "noop":
			return "text-gray-600 bg-gray-500/10 border-gray-500/30"
		default:
			return "text-gray-600 bg-gray-500/10 border-gray-500/30"
	}
}

interface NodeLibraryProps {
	className?: string
	onAddNode: (type: string, position: { x: number; y: number }) => void
}

export function NodeLibrary({ className, onAddNode }: NodeLibraryProps) {
	const [nodes, setNodes] = useState<NodeTypeConfig[] | null>(null)
	const [fetchError, setFetchError] = useState(false)
	const [search, setSearch] = useState("")
	const [collapsed, setCollapsed] = useState(false)
	const { screenToFlowPosition } = useReactFlow()

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

	/** Add a node at the centre of the visible viewport. */
	const handleClick = (nodeType: string) => {
		const position = screenToFlowPosition({
			x: window.innerWidth / 2,
			y: window.innerHeight / 2,
		})
		onAddNode(nodeType, position)
	}

	const displayNodes = nodes ?? FALLBACK_NODES
	const filteredNodes = search.trim()
		? displayNodes.filter(
				(n) =>
					n.label.toLowerCase().includes(search.toLowerCase()) ||
					n.description.toLowerCase().includes(search.toLowerCase()),
			)
		: displayNodes

	// Collapsed icon-strip view
	if (collapsed) {
		return (
			<aside className="flex flex-col items-center w-10 shrink-0 border-r bg-background pt-2 gap-2 overflow-y-auto">
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => setCollapsed(false)}
					title="Expand node library"
				>
					<ChevronRightSquareIcon className="size-3.5" />
				</Button>
				{displayNodes.map(({ type, label, icon: Icon, colorClass }) => (
					<button
						key={type}
						type="button"
						draggable
						onDragStart={(e) => onDragStart(e, type)}
						onClick={() => handleClick(type)}
						title={label}
						className={cn(
							"size-7 flex items-center justify-center rounded border",
							"cursor-grab active:cursor-grabbing hover:bg-accent transition-colors",
							colorClass,
						)}
					>
						<Icon className="size-3.5" />
					</button>
				))}
			</aside>
		)
	}

	return (
		<aside
			className={cn(
				"flex flex-col gap-2 w-52 shrink-0 border-r bg-background p-3 overflow-y-auto",
				className,
			)}
		>
			<div className="flex items-center justify-between mb-1">
				<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
					Nodes
				</p>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => setCollapsed(true)}
					title="Collapse node library"
					className="size-5"
				>
					<ChevronLeftSquareIcon className="size-3.5" />
				</Button>
			</div>

			<Input
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				placeholder="Search nodes…"
				className="h-7 text-xs"
			/>

			{nodes === null ? (
				<>
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-12 w-full" />
				</>
			) : filteredNodes.length === 0 ? (
				<p className="text-[10px] text-muted-foreground">No nodes match.</p>
			) : (
				filteredNodes.map(
					({ type, label, description, icon: Icon, colorClass }) => (
						<div
							key={type}
							draggable
							onDragStart={(e) => onDragStart(e, type)}
							onClick={() => handleClick(type)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") handleClick(type)
							}}
							role="button"
							tabIndex={0}
							title={`Drag or click to add ${label}`}
							className={cn(
								"flex items-start gap-2 rounded-lg border p-2.5 cursor-grab active:cursor-grabbing select-none",
								"hover:bg-accent transition-colors",
								colorClass,
							)}
						>
							<Icon className="size-3.5 shrink-0 mt-0.5" />
							<div>
								<p className="text-xs font-medium">{label}</p>
								<p className="text-[10px] text-muted-foreground">
									{description}
								</p>
							</div>
						</div>
					),
				)
			)}
			{fetchError && (
				<p className="text-[10px] text-destructive">
					Could not load nodes from server — showing defaults.
				</p>
			)}
			<p className="text-[10px] text-muted-foreground mt-2">
				Drag or click nodes to add them to the canvas.
			</p>
		</aside>
	)
}
