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

/** Placeholder to preserve column alignment when timestamp is absent. */
const EMPTY_TIMESTAMP = " ".repeat(12) // matches HH:MM:SS.mmm length

/** Normalise a Date-string or epoch-ms number to epoch-ms, defensively. */
function toMs(val: number | string | null | undefined): number | null {
	if (val === null || val === undefined) return null
	if (typeof val === "number") return val
	const ms = Date.parse(val as string)
	return Number.isFinite(ms) ? ms : null
}

function statusColor(status: string): string {
	if (status === "success") return "text-green-500 dark:text-green-400"
	if (status === "failed") return "text-red-500 dark:text-red-400"
	if (status === "skipped") return "text-yellow-600 dark:text-yellow-500"
	if (status === "running") return "text-blue-500 dark:text-blue-400"
	return "text-muted-foreground"
}

function statusBadge(status: string) {
	const base = "inline-block w-9 text-center font-bold uppercase text-[10px]"
	if (status === "success")
		return <span className={cn(base, "text-green-500 dark:text-green-400")}>DONE</span>
	if (status === "failed")
		return <span className={cn(base, "text-red-500 dark:text-red-400")}>FAIL</span>
	if (status === "skipped")
		return <span className={cn(base, "text-yellow-600 dark:text-yellow-500")}>SKIP</span>
	if (status === "running")
		return (
			<span className={cn(base, "text-blue-500 dark:text-blue-400 animate-pulse")}>
				RUN{" "}
			</span>
		)
	return <span className={cn(base, "text-muted-foreground")}>WAIT</span>
}

function formatDuration(
	startedAt: number | string | null,
	finishedAt: number | string | null
): string {
	const start = toMs(startedAt)
	if (!start) return ""
	const end = toMs(finishedAt) ?? Date.now()
	const ms = end - start
	if (ms < 1000) return `${ms}ms`
	return `${(ms / 1000).toFixed(1)}s`
}

function formatTs(ms: number | string | null): string {
	const t = toMs(ms)
	if (!t) return EMPTY_TIMESTAMP
	return new Date(t).toISOString().slice(11, 23)
}

function StepLine({ step }: { step: RunStep }) {
	const dur = formatDuration(step.startedAt, step.finishedAt)
	const ts = formatTs(step.startedAt)
	const logLines = step.logs ? step.logs.split("\n") : []

	return (
		<div className="font-mono text-xs leading-relaxed">
			<div className="flex items-baseline gap-2">
				<span className="text-muted-foreground/60 shrink-0">{ts}</span>
				{statusBadge(step.status)}
				<span className={cn("flex-1 truncate", statusColor(step.status))}>
					{step.stepName}
				</span>
				{dur && (
					<span className="text-muted-foreground/60 shrink-0 tabular-nums">
						{dur}
					</span>
				)}
			</div>
			{logLines.map((line, i) => (
				<div key={i} className="flex items-baseline gap-2 pl-[6.5rem]">
					<span className="text-muted-foreground/80 break-all">{line}</span>
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
				"shrink-0 border-t bg-muted/30 dark:bg-zinc-950 flex flex-col transition-all duration-200",
				minimized ? "h-9" : "h-72"
			)}
		>
			{/* Panel header */}
			<div className="flex items-center gap-2 px-3 h-9 shrink-0 border-b border-border">
				{/* Status icon */}
				{isOk && (
					<CheckCircleIcon className="size-3.5 text-green-500 dark:text-green-400 shrink-0" />
				)}
				{isFail && (
					<XCircleIcon className="size-3.5 text-red-500 dark:text-red-400 shrink-0" />
				)}
				{!isOk && !isFail && (
					<CircleDashedIcon
						className={cn(
							"size-3.5 text-muted-foreground shrink-0",
							isLive && "animate-spin [animation-duration:3s]"
						)}
					/>
				)}

				<span
					className={cn(
						"font-mono text-xs font-semibold",
						isOk && "text-green-500 dark:text-green-400",
						isFail && "text-red-500 dark:text-red-400",
						!isOk && !isFail && "text-foreground/70"
					)}
				>
					{run ? run.status.toUpperCase() : "CONNECTING…"}
				</span>

				{run && (
					<>
						<span className="text-muted-foreground/40 text-xs">·</span>
						<span className="font-mono text-xs text-muted-foreground">
							{steps.length} step{steps.length !== 1 ? "s" : ""}
						</span>
						{run.startedAt && (
							<>
								<span className="text-muted-foreground/40 text-xs">·</span>
								<ClockIcon className="size-3 text-muted-foreground/60 shrink-0" />
								<span className="font-mono text-xs text-muted-foreground tabular-nums">
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
					className="font-mono text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
				>
					<ExternalLinkIcon className="size-3" />
					Full view
				</Link>

				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => setMinimized((v) => !v)}
					className="size-6 text-muted-foreground hover:text-foreground"
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
					className="size-6 text-muted-foreground hover:text-foreground"
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
							<Skeleton className="h-3 w-48 bg-muted" />
							<Skeleton className="h-3 w-full bg-muted" />
						</div>
					) : steps.length === 0 ? (
						<p className="font-mono text-xs text-muted-foreground/60">
							Waiting for steps…
						</p>
					) : (
						steps.map((step) => <StepLine key={step.id} step={step} />)
					)}

					{isLive && run?.status === "running" && (
						<div className="font-mono text-xs text-muted-foreground flex items-center gap-1">
							<span className="inline-block w-1.5 h-3 bg-muted-foreground animate-pulse" />
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
							? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900/40 text-green-700 dark:text-green-500"
							: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-500"
					)}
				>
					▶ Run {runId.slice(0, 8)} exited with status{" "}
					<strong>{run.status.toUpperCase()}</strong>
				</div>
			)}

			{streamStatus === "error" && (
				<p className="px-4 py-1 text-xs text-red-500 font-mono border-t border-border shrink-0">
					⚠ Connection error — reload to reconnect.
				</p>
			)}
		</div>
	)
}
