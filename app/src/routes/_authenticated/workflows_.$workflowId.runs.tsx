import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeftIcon, PlayIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute(
	"/_authenticated/workflows/$workflowId/runs"
)({
	component: WorkflowRunsPage,
})

interface Workflow {
	id: string
	name: string
}
interface Run {
	id: string
	workflowId: string
	status: "queued" | "running" | "success" | "failed"
	startedAt: number | null
	finishedAt: number | null
}

function statusVariant(status: Run["status"]) {
	if (status === "success") return "default" as const
	if (status === "failed") return "destructive" as const
	if (status === "running") return "secondary" as const
	return "outline" as const
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

function WorkflowRunsPage() {
	const { workflowId } = Route.useParams()
	const [workflow, setWorkflow] = useState<Workflow | null>(null)
	const [runs, setRuns] = useState<Run[]>([])
	const [loading, setLoading] = useState(true)
	const [triggering, setTriggering] = useState(false)

	const reload = () => {
		Promise.all([
			fetch(`/api/v1/workflows/${workflowId}`).then((r) =>
				r.ok ? (r.json() as Promise<Workflow>) : null
			),
			fetch(`/api/v1/workflows/${workflowId}/runs`).then((r) =>
				r.ok ? (r.json() as Promise<Run[]>) : []
			),
		])
			.then(([wf, r]) => {
				setWorkflow(wf)
				setRuns(r ?? [])
			})
			.catch(() => toast.error("Failed to load runs"))
			.finally(() => setLoading(false))
	}

	useEffect(reload, [workflowId])

	const handleTrigger = async () => {
		setTriggering(true)
		try {
			const r = await fetch(`/api/v1/workflows/${workflowId}/run`, {
				method: "POST",
			})
			if (!r.ok) throw new Error("Failed to trigger")
			toast.success("Run started")
			reload()
		} catch {
			toast.error("Failed to start run")
		} finally {
			setTriggering(false)
		}
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<Button variant="ghost" size="icon-sm" asChild>
					<Link to="/workflows">
						<ArrowLeftIcon />
						<span className="sr-only">Back</span>
					</Link>
				</Button>
				<div className="flex-1">
					<h1 className="text-lg font-semibold">
						{loading ? "Loading…" : (workflow?.name ?? "Workflow")} — Runs
					</h1>
					<p className="text-muted-foreground text-xs">
						History of all workflow runs.
					</p>
				</div>
				<Button
					size="sm"
					disabled={triggering}
					onClick={() => void handleTrigger()}
				>
					<PlayIcon />
					{triggering ? "Starting…" : "Run Now"}
				</Button>
			</div>

			<Card>
				<CardHeader className="border-b pb-3">
					<CardTitle className="text-sm">Run History</CardTitle>
				</CardHeader>
				<CardContent className="p-0">
					{loading ? (
						<div className="space-y-2 p-4">
							{Array.from({ length: 4 }).map((_, i) => (
								<Skeleton key={i} className="h-10 w-full" />
							))}
						</div>
					) : runs.length === 0 ? (
						<p className="p-4 text-xs text-muted-foreground">
							No runs yet. Click "Run Now" to start.
						</p>
					) : (
						<table className="w-full text-xs">
							<thead>
								<tr className="border-b">
									<th className="text-left px-4 py-2 font-medium text-muted-foreground">
										Run ID
									</th>
									<th className="text-left px-4 py-2 font-medium text-muted-foreground">
										Status
									</th>
									<th className="text-left px-4 py-2 font-medium text-muted-foreground">
										Started
									</th>
									<th className="text-left px-4 py-2 font-medium text-muted-foreground">
										Duration
									</th>
									<th className="px-4 py-2" />
								</tr>
							</thead>
							<tbody>
								{runs.map((run) => (
									<tr
										key={run.id}
										className="border-b last:border-0 hover:bg-muted/40 transition-colors"
									>
										<td className="px-4 py-2.5 font-mono text-muted-foreground">
											{run.id.slice(0, 8)}…
										</td>
										<td className="px-4 py-2.5">
											<Badge variant={statusVariant(run.status)}>
												{run.status}
											</Badge>
										</td>
										<td className="px-4 py-2.5 text-muted-foreground tabular-nums">
											{run.startedAt
												? new Date(run.startedAt).toLocaleString()
												: "—"}
										</td>
										<td className="px-4 py-2.5 tabular-nums text-muted-foreground">
											{formatDuration(run.startedAt, run.finishedAt)}
										</td>
										<td className="px-4 py-2.5 text-right">
											<Link
												to="/runs/$runId"
												params={{ runId: run.id }}
												className="text-primary hover:underline"
											>
												View logs →
											</Link>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
