import { createFileRoute, Link } from "@tanstack/react-router"
import {
	ActivityIcon,
	ArrowLeftIcon,
	CheckCircleIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	CircleDashedIcon,
	ClockIcon,
	XCircleIcon,
} from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { type RunStep, useRunStream } from "@/hooks/use-run-stream"

export const Route = createFileRoute("/_authenticated/runs/$runId")({
	component: RunDetailPage,
})

function statusVariant(status: string) {
	if (status === "success") return "default" as const
	if (status === "failed" || status === "skipped") return "destructive" as const
	if (status === "running") return "secondary" as const
	return "outline" as const
}

function StepIcon({ status }: { status: string }) {
	if (status === "success")
		return <CheckCircleIcon className="size-3 text-green-500 shrink-0" />
	if (status === "failed")
		return <XCircleIcon className="size-3 text-red-500 shrink-0" />
	if (status === "running")
		return (
			<ActivityIcon className="size-3 text-blue-500 shrink-0 animate-pulse" />
		)
	if (status === "skipped")
		return <XCircleIcon className="size-3 text-muted-foreground shrink-0" />
	return <CircleDashedIcon className="size-3 text-muted-foreground shrink-0" />
}

function formatDuration(
	startedAt: number | null,
	finishedAt: number | null
): string {
	if (!startedAt) return "—"
	const end = finishedAt ?? Date.now()
	const ms = end - startedAt
	if (ms < 1000) return `${ms}ms`
	return `${(ms / 1000).toFixed(1)}s`
}

function StepCard({ step }: { step: RunStep }) {
	const [expanded, setExpanded] = useState(false)
	const hasDetails = Boolean(step.logs)

	return (
		<Collapsible open={expanded} onOpenChange={setExpanded}>
			<div className="rounded-lg border bg-card overflow-hidden">
				<div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
					<StepIcon status={step.status} />
					<span className="text-xs font-medium flex-1">{step.stepName}</span>
					<Badge variant={statusVariant(step.status)} className="shrink-0">
						{step.status}
					</Badge>
					<span className="text-xs text-muted-foreground tabular-nums flex items-center gap-1">
						<ClockIcon className="size-3" />
						{formatDuration(step.startedAt, step.finishedAt)}
					</span>
					{hasDetails && (
						<CollapsibleTrigger asChild>
							<Button variant="ghost" size="icon-sm" className="size-5">
								{expanded ? (
									<ChevronDownIcon className="size-3" />
								) : (
									<ChevronRightIcon className="size-3" />
								)}
							</Button>
						</CollapsibleTrigger>
					)}
				</div>
				<CollapsibleContent>
					{step.logs && (
						<pre className="px-3 py-2 text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words border-t">
							{step.logs}
						</pre>
					)}
				</CollapsibleContent>
			</div>
		</Collapsible>
	)
}

function RunDetailPage() {
	const { runId } = Route.useParams()
	const { snapshot, streamStatus } = useRunStream(runId)

	const run = snapshot?.run
	const steps = snapshot?.steps ?? []

	const isLive = streamStatus === "connecting" || streamStatus === "connected"

	return (
		<div className="space-y-4 max-w-3xl">
			<div className="flex items-center gap-2">
				<Button variant="ghost" size="icon-sm" asChild>
					<Link to="/workflows">
						<ArrowLeftIcon />
						<span className="sr-only">Back</span>
					</Link>
				</Button>
				<div className="flex-1">
					<div className="flex items-center gap-2">
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
					<p className="text-muted-foreground text-xs">
						Real-time step execution log.
					</p>
				</div>
			</div>

			{/* Run summary */}
			<Card>
				<CardHeader className="border-b pb-3">
					<CardTitle className="text-sm">Run Summary</CardTitle>
				</CardHeader>
				<CardContent className="pt-3">
					{streamStatus === "connecting" && !run ? (
						<div className="space-y-2">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-48" />
						</div>
					) : run ? (
						<dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
							<div>
								<dt className="text-muted-foreground">Status</dt>
								<dd className="mt-0.5">
									<Badge variant={statusVariant(run.status)}>
										{run.status}
									</Badge>
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Steps</dt>
								<dd className="mt-0.5 font-medium">{steps.length}</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Started</dt>
								<dd className="mt-0.5 tabular-nums">
									{run.startedAt
										? new Date(run.startedAt).toLocaleString()
										: "—"}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Duration</dt>
								<dd className="mt-0.5 tabular-nums">
									{formatDuration(run.startedAt, run.finishedAt)}
								</dd>
							</div>
						</dl>
					) : (
						<p className="text-xs text-muted-foreground">Run not found.</p>
					)}
				</CardContent>
			</Card>

			{/* Steps */}
			<div className="space-y-2">
				<h2 className="text-sm font-medium">Steps</h2>
				{streamStatus === "connecting" && steps.length === 0 ? (
					<div className="space-y-2">
						{Array.from({ length: 2 }).map((_, i) => (
							<Skeleton key={i} className="h-12 w-full" />
						))}
					</div>
				) : steps.length === 0 ? (
					<p className="text-xs text-muted-foreground">
						No steps recorded yet.
					</p>
				) : (
					steps.map((step) => <StepCard key={step.id} step={step} />)
				)}
			</div>

			{streamStatus === "error" && (
				<p className="text-xs text-destructive">
					Connection error. Reload the page to try again.
				</p>
			)}
		</div>
	)
}
