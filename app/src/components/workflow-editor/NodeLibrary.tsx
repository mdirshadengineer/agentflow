import { useReactFlow } from "@xyflow/react"
import {
	BotIcon,
	BoxIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CircleIcon,
	ClockIcon,
	CodeIcon,
	FilterIcon,
	FlagIcon,
	GitBranchIcon,
	GlobeIcon,
	LayersIcon,
	MousePointerClickIcon,
	ScrollIcon,
	TimerIcon,
	WebhookIcon,
	WrenchIcon,
} from "lucide-react"
import { type DragEvent, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { listNodes } from "@/lib/api/nodes"
import { cn } from "@/lib/utils"

interface NodeTypeConfig {
	/** Canonical type string passed to addNode() */
	type: string
	label: string
	description: string
	icon: React.ElementType
	/** Tailwind colour classes for icon badge */
	colorClass: string
	category: "triggers" | "flow" | "actions" | "utilities"
}

// ── Static built-in node entries ──────────────────────────────────────────────

const BUILTIN_NODES: NodeTypeConfig[] = [
	// Trigger variants
	{
		type: "trigger-manual",
		label: "Manual Trigger",
		description: "Start the workflow by clicking Run",
		icon: MousePointerClickIcon,
		colorClass: "text-green-600",
		category: "triggers",
	},
	{
		type: "trigger-scheduled",
		label: "Scheduled Trigger",
		description: "Run on a recurring cron schedule",
		icon: TimerIcon,
		colorClass: "text-green-600",
		category: "triggers",
	},
	{
		type: "trigger-webhook",
		label: "Webhook Trigger",
		description: "Start via an incoming HTTP POST",
		icon: WebhookIcon,
		colorClass: "text-green-600",
		category: "triggers",
	},
	// Flow control
	{
		type: "condition",
		label: "Condition",
		description: "Branch on a JS expression",
		icon: GitBranchIcon,
		colorClass: "text-amber-600",
		category: "flow",
	},
	// Actions
	{
		type: "agent",
		label: "AI Agent",
		description: "Run an AI agent step",
		icon: BotIcon,
		colorClass: "text-blue-600",
		category: "actions",
	},
	// Output
	{
		type: "output",
		label: "Output",
		description: "Collect the final workflow result",
		icon: FlagIcon,
		colorClass: "text-purple-600",
		category: "actions",
	},
]

// ── Icon / colour helpers for manifest nodes ──────────────────────────────────

function iconForType(type: string): React.ElementType {
	switch (type) {
		case "http-request":
			return GlobeIcon
		case "delay":
			return ClockIcon
		case "log":
			return ScrollIcon
		case "noop":
			return CircleIcon
		case "transform":
			return WrenchIcon
		case "json-extract":
			return CodeIcon
		case "filter":
			return FilterIcon
		case "subworkflow":
			return LayersIcon
		default:
			return BoxIcon
	}
}

function colorForType(type: string): string {
	switch (type) {
		case "http-request":
			return "text-cyan-600"
		case "delay":
			return "text-orange-600"
		case "log":
			return "text-slate-600"
		case "noop":
			return "text-gray-500"
		case "transform":
			return "text-indigo-600"
		case "json-extract":
			return "text-teal-600"
		case "filter":
			return "text-rose-600"
		case "subworkflow":
			return "text-violet-600"
		default:
			return "text-gray-600"
	}
}

function categoryForType(
	type: string
): "triggers" | "flow" | "actions" | "utilities" {
	switch (type) {
		case "filter":
			return "flow"
		case "noop":
			return "utilities"
		default:
			return "actions"
	}
}

// ── Category metadata ──────────────────────────────────────────────────────────

const CATEGORY_META: Record<
	"triggers" | "flow" | "actions" | "utilities",
	{ label: string; accent: string }
> = {
	triggers: {
		label: "Triggers",
		accent: "text-green-600 border-green-500/30 bg-green-500/5",
	},
	flow: {
		label: "Flow Control",
		accent: "text-amber-600 border-amber-500/30 bg-amber-500/5",
	},
	actions: {
		label: "Actions",
		accent: "text-blue-600 border-blue-500/30 bg-blue-500/5",
	},
	utilities: {
		label: "Utilities",
		accent: "text-gray-500 border-gray-500/30 bg-gray-500/5",
	},
}

const CATEGORY_ORDER: Array<"triggers" | "flow" | "actions" | "utilities"> = [
	"triggers",
	"flow",
	"actions",
	"utilities",
]

// ── NodeLibrary ────────────────────────────────────────────────────────────────

interface NodeLibraryProps {
	className?: string
	onAddNode: (type: string, position: { x: number; y: number }) => void
	canvasRef?: React.RefObject<HTMLElement | null>
}

export function NodeLibrary({
	className,
	onAddNode,
	canvasRef,
}: NodeLibraryProps) {
	const [manifestNodes, setManifestNodes] = useState<NodeTypeConfig[] | null>(
		null
	)
	const [search, setSearch] = useState("")
	const [collapsed, setCollapsed] = useState(false)
	const { screenToFlowPosition } = useReactFlow()

	useEffect(() => {
		listNodes()
			.then((manifests) => {
				setManifestNodes(
					manifests.map((m) => ({
						type: m.type,
						label: m.label,
						description: m.description,
						icon: iconForType(m.type),
						colorClass: colorForType(m.type),
						category: categoryForType(m.type),
					}))
				)
			})
			.catch(() => {
				setManifestNodes([]) // built-ins will still show
			})
	}, [])

	const allNodes = useMemo(() => {
		const manifest = manifestNodes ?? []
		// Merge: built-ins first, then any manifest type not already in built-ins
		const builtinTypes = new Set(BUILTIN_NODES.map((n) => n.type))
		const extraManifest = manifest.filter((n) => !builtinTypes.has(n.type))
		return [...BUILTIN_NODES, ...extraManifest]
	}, [manifestNodes])

	const filteredNodes = useMemo(() => {
		if (!search.trim()) return allNodes
		const q = search.toLowerCase()
		return allNodes.filter(
			(n) =>
				n.label.toLowerCase().includes(q) ||
				n.description.toLowerCase().includes(q)
		)
	}, [allNodes, search])

	const grouped = useMemo(() => {
		const map = new Map<
			"triggers" | "flow" | "actions" | "utilities",
			NodeTypeConfig[]
		>()
		for (const node of filteredNodes) {
			const list = map.get(node.category) ?? []
			list.push(node)
			map.set(node.category, list)
		}
		return map
	}, [filteredNodes])

	const onDragStart = (e: DragEvent<HTMLElement>, nodeType: string) => {
		e.dataTransfer.setData("application/agentflow-node-type", nodeType)
		e.dataTransfer.effectAllowed = "move"
	}

	const handleClick = (nodeType: string) => {
		const rect = canvasRef?.current?.getBoundingClientRect()
		const screenX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
		const screenY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
		const position = screenToFlowPosition({ x: screenX, y: screenY })
		onAddNode(nodeType, position)
	}

	// ── Collapsed icon-strip ─────────────────────────────────────────────────

	if (collapsed) {
		return (
			<aside className="flex flex-col items-center w-10 shrink-0 border-r bg-background pt-2 gap-1.5 overflow-y-auto">
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => setCollapsed(false)}
					title="Expand node library"
				>
					<ChevronRightIcon className="size-3.5" />
				</Button>
				{allNodes.map(({ type, label, icon: Icon, colorClass }) => (
					<button
						key={type}
						type="button"
						draggable
						onDragStart={(e) => onDragStart(e, type)}
						onClick={() => handleClick(type)}
						title={label}
						className={cn(
							"size-7 flex items-center justify-center rounded border border-border",
							"cursor-grab active:cursor-grabbing hover:bg-accent transition-colors",
							colorClass
						)}
					>
						<Icon className="size-3.5" />
					</button>
				))}
			</aside>
		)
	}

	// ── Expanded panel ───────────────────────────────────────────────────────

	return (
		<aside
			className={cn(
				"flex flex-col w-56 shrink-0 border-r bg-background overflow-hidden",
				className
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
				<p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
					Nodes
				</p>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => setCollapsed(true)}
					title="Collapse node library"
					className="size-5"
				>
					<ChevronLeftIcon className="size-3.5" />
				</Button>
			</div>

			{/* Search */}
			<div className="px-3 pb-2 shrink-0">
				<Input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Search nodes…"
					className="h-7 text-xs"
				/>
			</div>

			{/* Node list */}
			<div className="flex-1 overflow-y-auto px-2 pb-3">
				{manifestNodes === null ? (
					<div className="space-y-1.5 px-1 pt-1">
						<Skeleton className="h-14 w-full" />
						<Skeleton className="h-14 w-full" />
						<Skeleton className="h-14 w-full" />
					</div>
				) : filteredNodes.length === 0 ? (
					<p className="text-[10px] text-muted-foreground px-1 pt-1">
						No nodes match.
					</p>
				) : (
					CATEGORY_ORDER.map((cat) => {
						const nodes = grouped.get(cat)
						if (!nodes?.length) return null
						const meta = CATEGORY_META[cat]
						return (
							<div key={cat} className="mb-3">
								{/* Category header */}
								<div
									className={cn(
										"flex items-center gap-1.5 px-2 py-1 mb-1 rounded-md border text-[10px] font-semibold uppercase tracking-wider",
										meta.accent
									)}
								>
									{meta.label}
								</div>

								{/* Node cards */}
								<div className="space-y-1">
									{nodes.map(
										({ type, label, description, icon: Icon, colorClass }) => (
											<div
												key={type}
												draggable
												onDragStart={(e) => onDragStart(e, type)}
												onClick={() => handleClick(type)}
												onKeyDown={(e) => {
													if (e.key === "Enter" || e.key === " ") {
														e.preventDefault()
														handleClick(type)
													}
												}}
												role="button"
												tabIndex={0}
												title={`Drag or click to add ${label}`}
												className={cn(
													"flex items-start gap-2.5 rounded-md border border-border px-2.5 py-2",
													"cursor-grab active:cursor-grabbing select-none",
													"hover:bg-accent transition-colors",
													"border-l-[3px]",
													// Left accent stripe matches icon colour
													type.startsWith("trigger") && "border-l-green-500",
													type === "condition" && "border-l-amber-500",
													type === "filter" && "border-l-rose-500",
													type === "agent" && "border-l-blue-500",
													type === "output" && "border-l-purple-500",
													type === "http-request" && "border-l-cyan-500",
													type === "delay" && "border-l-orange-500",
													type === "log" && "border-l-slate-400",
													type === "transform" && "border-l-indigo-500",
													type === "json-extract" && "border-l-teal-500",
													type === "subworkflow" && "border-l-violet-500",
													type === "noop" && "border-l-gray-400"
												)}
											>
												{/* Icon badge */}
												<div
													className={cn(
														"size-6 shrink-0 flex items-center justify-center rounded",
														colorClass,
														"bg-current/10"
													)}
												>
													<Icon className={cn("size-3", colorClass)} />
												</div>

												{/* Text */}
												<div className="min-w-0 flex-1">
													<p className="text-[11px] font-medium leading-tight">
														{label}
													</p>
													<p className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">
														{description}
													</p>
												</div>
											</div>
										)
									)}
								</div>
							</div>
						)
					})
				)}
			</div>

			{/* Footer hint */}
			<div className="px-3 py-2 border-t shrink-0">
				<p className="text-[10px] text-muted-foreground">
					Drag or click to add to canvas
				</p>
			</div>
		</aside>
	)
}
