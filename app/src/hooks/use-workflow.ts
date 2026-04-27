import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
	createWorkflow,
	deleteWorkflow,
	listWorkflows,
	triggerRun,
	type Workflow,
} from "@/lib/api/workflows"

/** List-level hook used by the Workflows page. */
export function useWorkflows() {
	const [workflows, setWorkflows] = useState<Workflow[]>([])
	const [loading, setLoading] = useState(true)

	const reload = useCallback(() => {
		setLoading(true)
		listWorkflows()
			.then(setWorkflows)
			.catch(() => toast.error("Failed to load workflows"))
			.finally(() => setLoading(false))
	}, [])

	useEffect(reload, [reload])

	const handleCreate = useCallback(
		async (name: string, description?: string): Promise<Workflow | null> => {
			try {
				const wf = await createWorkflow({
					name,
					description,
					definition: { nodes: [], edges: [] },
				})
				toast.success("Workflow created")
				reload()
				return wf
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Failed to create workflow")
				return null
			}
		},
		[reload],
	)

	const handleDelete = useCallback(
		async (id: string, name: string): Promise<void> => {
			if (!confirm(`Delete workflow "${name}"?`)) return
			try {
				await deleteWorkflow(id)
				toast.success("Workflow deleted")
				reload()
			} catch {
				toast.error("Failed to delete workflow")
			}
		},
		[reload],
	)

	const handleRun = useCallback(async (id: string): Promise<string | null> => {
		try {
			const run = await triggerRun(id)
			toast.success(`Run started: ${run.id.slice(0, 8)}`)
			return run.id
		} catch {
			toast.error("Failed to start run")
			return null
		}
	}, [])

	return { workflows, loading, reload, handleCreate, handleDelete, handleRun }
}
