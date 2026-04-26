import { createFileRoute } from "@tanstack/react-router"
import {
	ActivityIcon,
	BotIcon,
	CheckCircleIcon,
	CircleDashedIcon,
	WorkflowIcon,
	XCircleIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/_authenticated/dashboard")({
	component: Dashboard,
})

interface Agent {
	id: string
	name: string
}
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

function statusBadgeVariant(status: Run["status"]) {
	if (status === "success") return "default" as const
	if (status === "failed") return "destructive" as const
	if (status === "running") return "secondary" as const
	return "outline" as const
}

function StatusIcon({ status }: { status: Run["status"] }) {
	if (status === "success")
		return <CheckCircleIcon className="size-3 text-green-500" />
	if (status === "failed")
		return <XCircleIcon className="size-3 text-red-500" />
	if (status === "running")
		return <ActivityIcon className="size-3 text-blue-500 animate-pulse" />
	return <CircleDashedIcon className="size-3 text-muted-foreground" />
}

function Dashboard() {
	const [agents, setAgents] = useState<Agent[]>([])
	const [workflows, setWorkflows] = useState<Workflow[]>([])
	const [runs, setRuns] = useState<Run[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		Promise.all([
			fetch("/api/v1/agents").then((r) => {
				if (!r.ok) throw new Error("Failed to fetch agents")
				return r.json() as Promise<Agent[]>
			}),
			fetch("/api/v1/workflows").then((r) => {
				if (!r.ok) throw new Error("Failed to fetch workflows")
				return r.json() as Promise<Workflow[]>
			}),
			fetch("/api/v1/runs").then((r) => {
				if (!r.ok) throw new Error("Failed to fetch runs")
				return r.json() as Promise<Run[]>
			}),
		])
			.then(([a, w, r]) => {
				setAgents(a)
				setWorkflows(w)
				setRuns(r)
			})
			.catch((err: unknown) => {
				setError(
					err instanceof Error ? err.message : "Failed to load dashboard data"
				)
			})
			.finally(() => setLoading(false))
	}, [])

	const runningCount = runs.filter((r) => r.status === "running").length
	const recentRuns = runs.slice(0, 8)

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-lg font-semibold">Dashboard</h1>
				<p className="text-muted-foreground text-xs mt-1">
					Overview of your agents and workflows.
				</p>
			</div>

			{error && (
				<p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{error}
				</p>
			)}

			{/* Stats row */}
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<StatCard
					loading={loading}
					icon={<BotIcon />}
					label="Agents"
					value={agents.length}
				/>
				<StatCard
					loading={loading}
					icon={<WorkflowIcon />}
					label="Workflows"
					value={workflows.length}
				/>
				<StatCard
					loading={loading}
					icon={<ActivityIcon />}
					label="Running Now"
					value={runningCount}
				/>
				<StatCard
					loading={loading}
					icon={<CheckCircleIcon />}
					label="Total Runs"
					value={runs.length}
				/>
			</div>

			{/* Recent runs */}
			<Card>
				<CardHeader className="border-b pb-3">
					<CardTitle className="text-sm font-medium">Recent Runs</CardTitle>
				</CardHeader>
				<CardContent className="p-0">
					{loading ? (
						<div className="space-y-2 p-4">
							{Array.from({ length: 4 }).map((_, i) => (
								<Skeleton key={i} className="h-8 w-full" />
							))}
						</div>
					) : recentRuns.length === 0 ? (
						<p className="p-4 text-xs text-muted-foreground">
							No runs yet. Trigger a workflow to get started.
						</p>
					) : (
						<ul className="divide-y">
							{recentRuns.map((run) => (
								<li
									key={run.id}
									className="flex items-center gap-3 px-4 py-2.5"
								>
									<StatusIcon status={run.status} />
									<span className="font-mono text-xs text-muted-foreground truncate flex-1">
										{run.id.slice(0, 8)}…
									</span>
									<Badge variant={statusBadgeVariant(run.status)}>
										{run.status}
									</Badge>
									{run.startedAt && (
										<span className="text-xs text-muted-foreground tabular-nums">
											{new Date(run.startedAt).toLocaleString()}
										</span>
									)}
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>
		</div>
	)
}

function StatCard({
	loading,
	icon,
	label,
	value,
}: {
	loading: boolean
	icon: React.ReactNode
	label: string
	value: number
}) {
	return (
		<Card>
			<CardContent className="flex items-center gap-3 pt-4 pb-4">
				<div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4">
					{icon}
				</div>
				<div>
					{loading ? (
						<Skeleton className="h-5 w-8" />
					) : (
						<p className="text-lg font-semibold leading-none">{value}</p>
					)}
					<p className="text-xs text-muted-foreground mt-0.5">{label}</p>
				</div>
			</CardContent>
		</Card>
	)
}
