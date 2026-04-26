import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type NodeStatus = "idle" | "running" | "success" | "error"

interface BaseNodeProps {
	selected?: boolean
	status?: NodeStatus
	icon?: ReactNode
	label: string
	description?: string
	children?: ReactNode
	className?: string
	badge?: string
	badgeColor?: string
}

const statusRing: Record<NodeStatus, string> = {
	idle: "",
	running: "ring-2 ring-yellow-400",
	success: "ring-2 ring-green-500",
	error: "ring-2 ring-red-500",
}

export function BaseNode({
	selected,
	status = "idle",
	icon,
	label,
	description,
	children,
	className,
	badge,
	badgeColor = "bg-neutral-700 text-neutral-200",
}: BaseNodeProps) {
	return (
		<div
			className={cn(
				"min-w-[200px] rounded-xl border border-neutral-700 bg-neutral-900 shadow-lg transition-all",
				selected && "border-sky-500 shadow-sky-500/20",
				statusRing[status],
				className
			)}
		>
			{/* Header */}
			<div className="flex items-center gap-2 border-neutral-700 border-b px-3 py-2">
				{icon && (
					<span className="flex size-5 items-center justify-center text-neutral-300">
						{icon}
					</span>
				)}
				<span className="flex-1 truncate text-xs font-semibold text-neutral-100">
					{label}
				</span>
				{badge && (
					<span
						className={cn(
							"rounded px-1.5 py-0.5 font-mono text-[10px]",
							badgeColor
						)}
					>
						{badge}
					</span>
				)}
			</div>

			{/* Body */}
			{(description || children) && (
				<div className="px-3 py-2">
					{description && (
						<p className="mb-1 text-[11px] text-neutral-400">{description}</p>
					)}
					{children}
				</div>
			)}

			{/* Status bar */}
			{status !== "idle" && (
				<div
					className={cn(
						"rounded-b-xl px-3 py-0.5 text-center text-[10px] font-medium",
						status === "running" && "bg-yellow-400/10 text-yellow-300",
						status === "success" && "bg-green-500/10 text-green-300",
						status === "error" && "bg-red-500/10 text-red-300"
					)}
				>
					{status === "running" && "Running…"}
					{status === "success" && "Success"}
					{status === "error" && "Error"}
				</div>
			)}
		</div>
	)
}
