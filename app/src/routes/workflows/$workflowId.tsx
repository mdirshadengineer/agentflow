import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { WorkflowCanvas } from "@/components/workflow-editor/WorkflowCanvas"

export const Route = createFileRoute("/workflows/$workflowId")({
	component: WorkflowEditorPage,
})

function WorkflowEditorPage() {
	const { workflowId } = Route.useParams()

	return (
		<div className="flex h-screen flex-col bg-neutral-950">
			{/* Top bar */}
			<div className="flex h-8 shrink-0 items-center gap-2 border-neutral-800 border-b bg-neutral-900 px-3">
				<Link
					to="/workflows"
					className="flex items-center gap-1 text-[11px] text-neutral-400 transition-colors hover:text-neutral-100"
				>
					<ArrowLeft className="size-3" />
					Workflows
				</Link>
				<span className="text-neutral-700">/</span>
				<span className="text-[11px] font-mono text-neutral-500 truncate">
					{workflowId}
				</span>
			</div>

			{/* Canvas — takes remaining height */}
			<div className="flex-1 overflow-hidden">
				<WorkflowCanvas workflowId={workflowId} />
			</div>
		</div>
	)
}
