import { createFileRoute, Link } from "@tanstack/react-router"
import {
	ArrowLeftIcon,
	CheckCircleIcon,
	CircleDashedIcon,
	ClockIcon,
	TerminalIcon,
	XCircleIcon,
} from "lucide-react"
import { useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { type RunStep, useRunStream } from "@/hooks/use-run-stream"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_authenticated/runs_/$runId")({
	component: RunDetailPage,
})

function statusColor(status: string): string {
	if (status === "success") return "text-green-400"
	if (status === "failed") return "text-red-400"
	if (status === "skipped") return "text-yellow-500"
	if (status === "running") return "text-blue-400"
	return "text-zinc-500"
}

function statusBadge(status: string) {
	const base = "inline-block w-9 text-center font-bold uppercase text-[10px]"
	if (status === "success") return <span className={cn(base, "text-green-400")}>DONE</span>
	if (status === "failed") return <span className={cn(base, "text-red-400")}>FAIL</span>
	if (status === "skipped") return <span className={cn(base, "text-yellow-500")}>SKIP</span>
	if (status === "running") return <span className={cn(base, "text-blue-400 animate-pulse")}>RUN </span>
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
	return new Date(ms).toISOString().slice(11, 23) // HH:MM:SS.mmm
}

function StepLine({ step }: { step: RunStep }) {
	const dur = formatDuration(step.startedAt, step.finishedAt)
	const ts = formatTs(step.startedAt)
	const logLines = step.logs ? step.logs.split("\n") : []

	return (
		<div className="font-mono text-xs leading-relaxed">
			{/* Main step line */}
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
			{/* Log output lines */}
			{logLines.map((line, i) => (
				<div key={i} className="flex items-baseline gap-2 pl-[6.5rem]">
					<span className="text-zinc-500 break-all">{line}</span>
				</div>
			))}
		</div>
	)
}

function RunSummaryBar({
	status,
	startedAt,
	finishedAt,
	stepCount,
}: {
	status: string
	startedAt: number | null
	finishedAt: number | null
	stepCount: number
}) {
	const isOk = status === "success"
	const isFail = status === "failed"
	return (
		<div
			className={cn(
				"flex items-center gap-3 px-4 py-2 rounded-t-lg border-b font-mono text-xs",
				"bg-zinc-900 border-zinc-700",
			)}
		>
			{isOk && <CheckCircleIcon className="size-3.5 text-green-400 shrink-0" />}
			{isFail && <XCircleIcon className="size-3.5 text-red-400 shrink-0" />}
			{!isOk && !isFail && (
				<CircleDashedIcon className="size-3.5 text-zinc-500 shrink-0 animate-spin" style={{ animationDuration: "3s" }} />
			)}
			<span
				className={cn(
					"font-semibold",
					isOk && "text-green-400",
					isFail && "text-red-400",
					!isOk && !isFail && "text-zinc-400",
				)}
			>
				{status.toUpperCase()}
			</span>
			<span className="text-zinc-500">·</span>
			<span className="text-zinc-400">{stepCount} steps</span>
			{startedAt && (
				<>
					<span className="text-zinc-500">·</span>
					<ClockIcon className="size-3 text-zinc-500 shrink-0" />
					<span className="text-zinc-400 tabular-nums">
						{formatDuration(startedAt, finishedAt)}
					</span>
				</>
			)}
			<div className="flex-1" />
			<span className="text-zinc-600">
				{startedAt ? new Date(startedAt).toLocaleString() : "—"}
			</span>
		</div>
	)
}

function RunDetailPage() {
	const { runId } = Route.useParams()
	const { snapshot, streamStatus } = useRunStream(runId)
	const bottomRef = useRef<HTMLDivElement>(null)

	const run = snapshot?.run
	const steps = snapshot?.steps ?? []

	const isLive = streamStatus === "connecting" || streamStatus === "connected"

	// Auto-scroll terminal to bottom when new steps arrive
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [steps.length])

	return (
		<div className="space-y-4 max-w-3xl">
			{/* Header */}
			<div className="flex items-center gap-2">
				<Button variant="ghost" size="icon-sm" asChild>
					<Link to="/workflows">
						<ArrowLeftIcon />
						<span className="sr-only">Back</span>
					</Link>
				</Button>
				<div className="flex-1">
					<div className="flex items-center gap-2">
						<TerminalIcon className="size-4 text-muted-foreground" />
						<h1 className="text-lg font-semibold">Run</h1>
						<span className="font-mono text-sm text-muted-foreground">
							{runId.slice(0, 8)}…
						</span>
						{isLive && run?.status === "running" && (
							<Badge variant="secondary" className="animate-pulse">
								Live
							</Badge>
						)}
					</div>
					<p className="text-muted-foreground text-xs ml-6">
						Real-time execution log
					</p>
				</div>
			</div>

			{/* Terminal panel */}
			{streamStatus === "connecting" && !run ? (
				<div className="space-y-1 rounded-lg overflow-hidden border border-zinc-700">
					<div className="bg-zinc-900 px-4 py-2 border-b border-zinc-700">
						<Skeleton className="h-3 w-48 bg-zinc-700" />
					</div>
					<div className="bg-zinc-950 px-4 py-3 space-y-2">
						<Skeleton className="h-3 w-full bg-zinc-800" />
						<Skeleton className="h-3 w-3/4 bg-zinc-800" />
					</div>
				</div>
			) : run ? (
				<div className="rounded-lg overflow-hidden border border-zinc-700">
					<RunSummaryBar
						status={run.status}
						startedAt={run.startedAt}
						finishedAt={run.finishedAt}
						stepCount={steps.length}
					/>

					{/* Step lines */}
					<div className="bg-zinc-950 px-4 py-3 min-h-24 max-h-[60vh] overflow-y-auto space-y-1.5">
						{steps.length === 0 ? (
							<p className="font-mono text-xs text-zinc-600">
								Waiting for steps…
							</p>
						) : (
							steps.map((step) => <StepLine key={step.id} step={step} />)
						)}

						{/* Blinking cursor while live */}
						{isLive && run.status === "running" && (
							<div className="font-mono text-xs text-zinc-500 flex items-center gap-1">
								<span className="inline-block w-1.5 h-3 bg-zinc-500 animate-pulse" />
							</div>
						)}

						<div ref={bottomRef} />
					</div>

					{/* Status footer */}
					{(streamStatus === "done" || run.status === "success" || run.status === "failed") && (
						<div
							className={cn(
								"px-4 py-1.5 font-mono text-[10px] border-t",
								run.status === "success"
									? "bg-green-950/40 border-green-900/40 text-green-500"
									: "bg-red-950/40 border-red-900/40 text-red-500",
							)}
						>
							▶ Run {runId.slice(0, 8)} exited with status{" "}
							<strong>{run.status.toUpperCase()}</strong>
						</div>
					)}
				</div>
			) : (
				<p className="text-sm text-muted-foreground">Run not found.</p>
			)}

			{streamStatus === "error" && (
				<p className="text-xs text-destructive font-mono">
					⚠ Connection error. Reload the page to reconnect.
				</p>
			)}
		</div>
	)
}
