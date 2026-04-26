import { createFileRoute, Link } from "@tanstack/react-router"
import { EditIcon, PlayIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
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
import { useWorkflows } from "@/hooks/use-workflow"
import type { Workflow } from "@/lib/api/workflows"

export const Route = createFileRoute("/_authenticated/workflows")({
	component: WorkflowsPage,
})

function WorkflowsPage() {
	const { workflows, loading, handleCreate, handleDelete, handleRun } =
		useWorkflows()
	const [createOpen, setCreateOpen] = useState(false)
	const [runningId, setRunningId] = useState<string | null>(null)

	const onRun = async (id: string) => {
		setRunningId(id)
		await handleRun(id)
		setRunningId(null)
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
							onCreate={async (name, description) => {
								const wf = await handleCreate(name, description)
								if (wf) setCreateOpen(false)
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
						<WorkflowCard
							key={wf.id}
							workflow={wf}
							runningId={runningId}
							onRun={() => void onRun(wf.id)}
							onDelete={() => void handleDelete(wf.id, wf.name)}
						/>
					))}
				</div>
			)}
		</div>
	)
}

function WorkflowCard({
	workflow: wf,
	runningId,
	onRun,
	onDelete,
}: {
	workflow: Workflow
	runningId: string | null
	onRun: () => void
	onDelete: () => void
}) {
	return (
		<Card className="group">
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
						onClick={onDelete}
					>
						<Trash2Icon />
						<span className="sr-only">Delete</span>
					</Button>
				</div>
				{wf.description && (
					<p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
						{wf.description}
					</p>
				)}
			</CardHeader>
			<CardContent className="pt-3 flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<Link
						to="/workflows/$workflowId/runs"
						params={{ workflowId: wf.id }}
						className="text-xs text-muted-foreground hover:text-foreground transition-colors"
					>
						Runs →
					</Link>
					<Link
						to="/workflows/$workflowId/edit"
						params={{ workflowId: wf.id }}
						className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
					>
						<EditIcon className="size-3" />
						Edit
					</Link>
				</div>
				<Button
					size="icon-xs"
					variant="outline"
					disabled={runningId === wf.id}
					onClick={onRun}
					title="Trigger run"
				>
					<PlayIcon />
					<span className="sr-only">Run</span>
				</Button>
			</CardContent>
		</Card>
	)
}

function CreateWorkflowForm({
	onCreate,
}: {
	onCreate: (name: string, description?: string) => Promise<void>
}) {
	const [name, setName] = useState("")
	const [description, setDescription] = useState("")
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)
		setLoading(true)
		try {
			await onCreate(name, description || undefined)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create workflow")
			toast.error("Failed to create workflow")
		} finally {
			setLoading(false)
		}
	}

	return (
		<form onSubmit={(e) => void handleSubmit(e)}>
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
					<FieldLabel htmlFor="wf-desc">Description</FieldLabel>
					<Input
						id="wf-desc"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Optional description"
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
