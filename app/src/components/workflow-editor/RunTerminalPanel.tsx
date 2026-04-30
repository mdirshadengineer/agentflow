import { Link } from "@tanstack/react-router"
import {
	CheckCircleIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	CircleDashedIcon,
	ClockIcon,
	ExternalLinkIcon,
	XCircleIcon,
	XIcon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { type RunStep, useRunStream } from "@/hooks/use-run-stream"
import { cn } from "@/lib/utils"

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusColor(status: string): string {
	if (status === "success") return "text-green-400"
	if (status === "failed") return "text-red-400"
	if (status === "skipped") return "text-yellow-500"
	if (status === "running") return "text-blue-400"
	return "text-zinc-500"
}

function statusBadge(status: string) {
	const base = "inline-block w-9 text-center font-bold uppercase text-[10px]"
	if (status === "success")
		return <span className={cn(base, "text-green-400")}>DONE</span>
	if (status === "failed")
		return <span className={cn(base, "text-red-400")}>FAIL</span>
	if (status === "skipped")
		return <span className={cn(base, "text-yellow-500")}>SKIP</span>
	if (status === "running")
		return <span className={cn(base, "text-blue-400 animate-pulse")}>RUN </span>
	return <span className={cn(base, "text-zinc-500")}>WAIT</span>
}

function formatDuration(
	startedAt: number | null,
	finishedAt: number | null
): string {
	if (!startedAt) return ""
	const end = finishedAt ?? Date.now()
	const ms = end - startedAt
	if (ms < 1000) return `${ms}ms`
	return `${(ms / 1000).toFixed(1)}s`
}

function formatTs(ms: number | null): string {
	if (!ms) return "         "
	return new Date(ms).toISOString().slice(11, 23)
}

function StepLine({ step }: { step: RunStep }) {
	const dur = formatDuration(step.startedAt, step.finishedAt)
	const ts = formatTs(step.startedAt)
	const logLines = step.logs ? step.logs.split("\n") : []

	return (
		<div className="font-mono text-xs leading-relaxed">
			<div className="flex items-baseline gap-2">
				<span className="text-zinc-600 shrink-0">{ts}</span>
				{statusBadge(step.status)}
				<span className={cn("flex-1 truncate", statusColor(step.status))}>
					{step.stepName}
				</span>
				{dur && (
					<span className="text-zinc-600 shrink-0 tabular-nums">{dur}</span>
				)}
			</div>
			{logLines.map((line, i) => (
				<div key={i} className="flex items-baseline gap-2 pl-[6.5rem]">
					<span className="text-zinc-500 break-all">{line}</span>
				</div>
			))}
		</div>
	)
}

// ── Public component ───────────────────────────────────────────────────────────

interface RunTerminalPanelProps {
	runId: string
	onClose: () => void
}

export function RunTerminalPanel({ runId, onClose }: RunTerminalPanelProps) {
	const { snapshot, streamStatus } = useRunStream(runId)
	const bottomRef = useRef<HTMLDivElement>(null)
	const [minimized, setMinimized] = useState(false)

	const run = snapshot?.run
	const steps = snapshot?.steps ?? []
	const isLive = streamStatus === "connecting" || streamStatus === "connected"
	const isOk = run?.status === "success"
	const isFail = run?.status === "failed"
	const isDone =
		streamStatus === "done" ||
		run?.status === "success" ||
		run?.status === "failed"

	// Auto-scroll to bottom as new steps arrive
	useEffect(() => {
		if (!minimized) {
			bottomRef.current?.scrollIntoView({ behavior: "smooth" })
		}
	}, [steps.length, minimized])

	return (
		<div
			className={cn(
				"shrink-0 border-t bg-zinc-950 flex flex-col transition-all duration-200",
				minimized ? "h-9" : "h-72"
			)}
		>
			{/* Panel header */}
			<div className="flex items-center gap-2 px-3 h-9 shrink-0 border-b border-zinc-800">
				{/* Status icon */}
				{isOk && (
					<CheckCircleIcon className="size-3.5 text-green-400 shrink-0" />
				)}
				{isFail && <XCircleIcon className="size-3.5 text-red-400 shrink-0" />}
				{!isOk && !isFail && (
					<CircleDashedIcon
						className={cn(
							"size-3.5 text-zinc-500 shrink-0",
							isLive && "animate-spin [animation-duration:3s]"
						)}
					/>
				)}

				<span
					className={cn(
						"font-mono text-xs font-semibold",
						isOk && "text-green-400",
						isFail && "text-red-400",
						!isOk && !isFail && "text-zinc-400"
					)}
				>
					{run ? run.status.toUpperCase() : "CONNECTING…"}
				</span>

				{run && (
					<>
						<span className="text-zinc-600 text-xs">·</span>
						<span className="font-mono text-xs text-zinc-500">
							{steps.length} step{steps.length !== 1 ? "s" : ""}
						</span>
						{run.startedAt && (
							<>
								<span className="text-zinc-600 text-xs">·</span>
								<ClockIcon className="size-3 text-zinc-600 shrink-0" />
								<span className="font-mono text-xs text-zinc-500 tabular-nums">
									{formatDuration(run.startedAt, run.finishedAt)}
								</span>
							</>
						)}
					</>
				)}

				<div className="flex-1" />

				<Link
					to="/runs/$runId"
					params={{ runId }}
					className="font-mono text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-0.5 transition-colors"
				>
					<ExternalLinkIcon className="size-3" />
					Full view
				</Link>

				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => setMinimized((v) => !v)}
					className="size-6 text-zinc-500 hover:text-zinc-300"
					title={minimized ? "Expand terminal" : "Minimize terminal"}
				>
					{minimized ? (
						<ChevronUpIcon className="size-3" />
					) : (
						<ChevronDownIcon className="size-3" />
					)}
				</Button>

				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onClose}
					className="size-6 text-zinc-500 hover:text-zinc-300"
					title="Close terminal"
				>
					<XIcon className="size-3" />
				</Button>
			</div>

			{/* Terminal body */}
			{!minimized && (
				<div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
					{streamStatus === "connecting" && !run ? (
						<div className="space-y-1 pt-1">
							<Skeleton className="h-3 w-48 bg-zinc-800" />
							<Skeleton className="h-3 w-full bg-zinc-800" />
						</div>
					) : steps.length === 0 ? (
						<p className="font-mono text-xs text-zinc-600">
							Waiting for steps…
						</p>
					) : (
						steps.map((step) => <StepLine key={step.id} step={step} />)
					)}

					{isLive && run?.status === "running" && (
						<div className="font-mono text-xs text-zinc-500 flex items-center gap-1">
							<span className="inline-block w-1.5 h-3 bg-zinc-500 animate-pulse" />
						</div>
					)}

					<div ref={bottomRef} />
				</div>
			)}

			{/* Status footer bar */}
			{!minimized && isDone && run && (
				<div
					className={cn(
						"px-4 py-1 font-mono text-[10px] border-t shrink-0",
						isOk
							? "bg-green-950/40 border-green-900/40 text-green-500"
							: "bg-red-950/40 border-red-900/40 text-red-500"
					)}
				>
					▶ Run {runId.slice(0, 8)} exited with status{" "}
					<strong>{run.status.toUpperCase()}</strong>
				</div>
			)}

			{streamStatus === "error" && (
				<p className="px-4 py-1 text-xs text-red-400 font-mono border-t border-zinc-800 shrink-0">
					⚠ Connection error — reload to reconnect.
				</p>
			)}
		</div>
	)
}
