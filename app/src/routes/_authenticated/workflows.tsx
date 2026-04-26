import { createFileRoute, Link } from "@tanstack/react-router"
import { PlayIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

export const Route = createFileRoute("/_authenticated/workflows")({
	component: WorkflowsPage,
})

interface Workflow {
	id: string
	name: string
	definition: unknown
	createdAt: number
	updatedAt: number
}

async function fetchWorkflows(): Promise<Workflow[]> {
	const r = await fetch("/api/v1/workflows")
	if (!r.ok) throw new Error("Failed to fetch workflows")
	return r.json() as Promise<Workflow[]>
}

async function deleteWorkflow(id: string): Promise<void> {
	const r = await fetch(`/api/v1/workflows/${id}`, { method: "DELETE" })
	if (!r.ok) throw new Error("Failed to delete workflow")
}

async function runWorkflow(id: string): Promise<{ id: string }> {
	const r = await fetch(`/api/v1/workflows/${id}/run`, { method: "POST" })
	if (!r.ok) throw new Error("Failed to trigger run")
	return r.json() as Promise<{ id: string }>
}

function WorkflowsPage() {
	const [workflows, setWorkflows] = useState<Workflow[]>([])
	const [loading, setLoading] = useState(true)
	const [createOpen, setCreateOpen] = useState(false)
	const [runningId, setRunningId] = useState<string | null>(null)

	const reload = () => {
		setLoading(true)
		fetchWorkflows()
			.then(setWorkflows)
			.catch(() => toast.error("Failed to load workflows"))
			.finally(() => setLoading(false))
	}

	useEffect(reload, [])

	const handleDelete = async (id: string, name: string) => {
		if (!confirm(`Delete workflow "${name}"?`)) return
		try {
			await deleteWorkflow(id)
			toast.success("Workflow deleted")
			reload()
		} catch {
			toast.error("Failed to delete workflow")
		}
	}

	const handleRun = async (id: string) => {
		setRunningId(id)
		try {
			const run = await runWorkflow(id)
			toast.success(`Run started: ${run.id.slice(0, 8)}`)
		} catch {
			toast.error("Failed to start run")
		} finally {
			setRunningId(null)
		}
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-lg font-semibold">Workflows</h1>
					<p className="text-muted-foreground text-xs mt-1">
						Automate tasks with multi-step workflows.
					</p>
				</div>
				<Dialog open={createOpen} onOpenChange={setCreateOpen}>
					<DialogTrigger asChild>
						<Button size="sm">
							<PlusIcon />
							New Workflow
						</Button>
					</DialogTrigger>
					<DialogContent>
						<CreateWorkflowForm
							onSuccess={() => {
								setCreateOpen(false)
								reload()
							}}
						/>
					</DialogContent>
				</Dialog>
			</div>

			{loading ? (
				<div className="space-y-2">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} className="h-20 w-full" />
					))}
				</div>
			) : workflows.length === 0 ? (
				<Card>
					<CardContent className="py-8 text-center text-xs text-muted-foreground">
						No workflows yet. Create your first workflow to automate tasks.
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{workflows.map((wf) => (
						<Card key={wf.id} className="group">
							<CardHeader className="border-b pb-3">
								<div className="flex items-start justify-between gap-2">
									<CardTitle className="text-sm font-medium leading-snug">
										<Link
											to="/workflows/$workflowId/runs"
											params={{ workflowId: wf.id }}
											className="hover:underline"
										>
											{wf.name}
										</Link>
									</CardTitle>
									<Button
										variant="ghost"
										size="icon-xs"
										className="opacity-0 group-hover:opacity-100 transition-opacity"
										onClick={() => void handleDelete(wf.id, wf.name)}
									>
										<Trash2Icon />
										<span className="sr-only">Delete</span>
									</Button>
								</div>
							</CardHeader>
							<CardContent className="pt-3 flex items-center justify-between gap-2">
								<Link
									to="/workflows/$workflowId/runs"
									params={{ workflowId: wf.id }}
									className="text-xs text-muted-foreground hover:text-foreground transition-colors"
								>
									View run history →
								</Link>
								<Button
									size="icon-xs"
									variant="outline"
									disabled={runningId === wf.id}
									onClick={() => void handleRun(wf.id)}
									title="Trigger run"
								>
									<PlayIcon />
									<span className="sr-only">Run</span>
								</Button>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	)
}

function CreateWorkflowForm({ onSuccess }: { onSuccess: () => void }) {
	const [name, setName] = useState("")
	const [definitionText, setDefinitionText] = useState(
		JSON.stringify(
			{
				steps: [{ name: "step-1", type: "noop" }],
				triggers: [],
			},
			null,
			2
		)
	)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)

		let definition: unknown
		try {
			definition = JSON.parse(definitionText)
		} catch {
			setError("Definition must be valid JSON")
			return
		}

		setLoading(true)
		try {
			const r = await fetch("/api/v1/workflows", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, definition }),
			})
			if (!r.ok) {
				const body = (await r.json()) as { error: string }
				throw new Error(body.error)
			}
			toast.success("Workflow created")
			onSuccess()
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create workflow")
		} finally {
			setLoading(false)
		}
	}

	return (
		<form onSubmit={handleSubmit}>
			<DialogHeader>
				<DialogTitle>Create Workflow</DialogTitle>
			</DialogHeader>
			<FieldGroup className="my-4">
				{error && (
					<p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{error}
					</p>
				)}
				<Field>
					<FieldLabel htmlFor="wf-name">Name *</FieldLabel>
					<Input
						id="wf-name"
						required
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="My Workflow"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="wf-def">Definition (JSON)</FieldLabel>
					<Textarea
						id="wf-def"
						rows={10}
						value={definitionText}
						onChange={(e) => setDefinitionText(e.target.value)}
						className="font-mono text-xs"
					/>
				</Field>
			</FieldGroup>
			<DialogFooter>
				<Button type="submit" disabled={loading}>
					{loading ? "Creating…" : "Create Workflow"}
				</Button>
			</DialogFooter>
		</form>
	)
}
