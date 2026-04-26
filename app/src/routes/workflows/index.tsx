import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { formatDistanceToNow } from "date-fns"
import { ArrowRight, Calendar, Plus, Workflow } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

type WorkflowRecord = {
	id: string
	name: string
	description: string
	createdAt: string
	updatedAt: string
}

export const Route = createFileRoute("/workflows/")({
	component: WorkflowsPage,
})

function WorkflowsPage() {
	const navigate = useNavigate()
	const [workflows, setWorkflows] = useState<WorkflowRecord[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [isCreating, setIsCreating] = useState(false)

	useEffect(() => {
		fetch("/api/v1/workflows")
			.then((r) => r.json())
			.then((data) => setWorkflows(data as WorkflowRecord[]))
			.catch((e) => setError(e.message))
			.finally(() => setIsLoading(false))
	}, [])

	const handleCreate = async () => {
		setIsCreating(true)
		try {
			const res = await fetch("/api/v1/workflows", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Untitled Workflow", description: "" }),
			})
			if (!res.ok) throw new Error("Failed to create workflow")
			const data: WorkflowRecord = await res.json()
			navigate({
				to: "/workflows/$workflowId",
				params: { workflowId: data.id },
			})
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unknown error")
		} finally {
			setIsCreating(false)
		}
	}

	return (
		<div className="min-h-screen bg-neutral-950 text-neutral-100">
			{/* Header */}
			<div className="border-neutral-800 border-b bg-neutral-900/80 px-6 py-4">
				<div className="mx-auto flex max-w-5xl items-center justify-between">
					<div className="flex items-center gap-2.5">
						<Workflow className="size-5 text-sky-400" />
						<h1 className="text-base font-semibold">Workflows</h1>
					</div>
					<Button
						onClick={handleCreate}
						disabled={isCreating}
						className="bg-sky-600 text-white hover:bg-sky-700"
						size="sm"
					>
						<Plus />
						{isCreating ? "Creating…" : "New Workflow"}
					</Button>
				</div>
			</div>

			{/* Content */}
			<div className="mx-auto max-w-5xl p-6">
				{isLoading && (
					<div className="flex items-center justify-center py-20">
						<div className="size-6 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
					</div>
				)}

				{error && (
					<div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
						{error}
					</div>
				)}

				{!isLoading && !error && workflows.length === 0 && (
					<div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
						<Workflow className="size-12 text-neutral-700" />
						<p className="text-neutral-400">No workflows yet</p>
						<Button
							onClick={handleCreate}
							className="bg-sky-600 text-white hover:bg-sky-700"
							size="sm"
						>
							<Plus />
							Create your first workflow
						</Button>
					</div>
				)}

				{!isLoading && workflows.length > 0 && (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{workflows.map((wf) => (
							<Link
								key={wf.id}
								to="/workflows/$workflowId"
								params={{ workflowId: wf.id }}
								className="group flex flex-col gap-2 rounded-xl border border-neutral-700 bg-neutral-900 p-4 transition-colors hover:border-sky-500/50 hover:bg-neutral-800"
							>
								<div className="flex items-start justify-between">
									<div className="flex items-center gap-2">
										<Workflow className="size-4 shrink-0 text-sky-400" />
										<span className="text-sm font-medium text-neutral-100 truncate">
											{wf.name}
										</span>
									</div>
									<ArrowRight className="size-3.5 shrink-0 text-neutral-600 transition-colors group-hover:text-sky-400" />
								</div>

								{wf.description && (
									<p className="text-[11px] text-neutral-500 line-clamp-2">
										{wf.description}
									</p>
								)}

								<div className="mt-auto flex items-center gap-1 text-[10px] text-neutral-600">
									<Calendar className="size-3" />
									<span>
										Updated{" "}
										{formatDistanceToNow(new Date(wf.updatedAt), {
											addSuffix: true,
										})}
									</span>
								</div>
							</Link>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
