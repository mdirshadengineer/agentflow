import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ReactFlowProvider } from "@xyflow/react"
import { getWorkflow, triggerRun } from "@/lib/api/workflows"
import type { WorkflowDefinition } from "@/types/workflow"
import { WorkflowCanvas } from "@/components/workflow-editor/WorkflowCanvas"
import { WorkflowEditorToolbar } from "@/components/workflow-editor/WorkflowEditorToolbar"
import { NodeLibrary } from "@/components/workflow-editor/NodeLibrary"
import { NodeConfigPanel } from "@/components/workflow-editor/NodeConfigPanel"
import { AiGeneratePanel } from "@/components/workflow-editor/AiGeneratePanel"
import { useWorkflowEditor } from "@/hooks/use-workflow-editor"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute(
	"/_authenticated/workflows/$workflowId/edit",
)({
	component: WorkflowEditorPage,
})

const EMPTY_DEFINITION: WorkflowDefinition = { nodes: [], edges: [] }

function WorkflowEditorPage() {
	const { workflowId } = Route.useParams()
	const navigate = useNavigate()
	const [initialDefinition, setInitialDefinition] =
		useState<WorkflowDefinition | null>(null)
	const [initialName, setInitialName] = useState<string | null>(null)
	const [loadError, setLoadError] = useState<string | null>(null)

	useEffect(() => {
		getWorkflow(workflowId)
			.then((wf) => {
				setInitialName(wf.name)
				setInitialDefinition(wf.definition ?? EMPTY_DEFINITION)
			})
			.catch((err) => {
				setLoadError(err instanceof Error ? err.message : "Failed to load workflow")
			})
	}, [workflowId])

	if (loadError) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-destructive">
				{loadError}
			</div>
		)
	}

	if (initialDefinition === null || initialName === null) {
		return (
			<div className="flex flex-col gap-3 p-6">
				<Skeleton className="h-12 w-full" />
				<Skeleton className="h-[400px] w-full" />
			</div>
		)
	}

	return (
		<ReactFlowProvider>
			<EditorInner
				workflowId={workflowId}
				initialName={initialName}
				initialDefinition={initialDefinition}
				onRunNavigate={(runId) =>
					void navigate({ to: "/runs/$runId", params: { runId } })
				}
			/>
		</ReactFlowProvider>
	)
}

function EditorInner({
	workflowId,
	initialName,
	initialDefinition,
	onRunNavigate,
}: {
	workflowId: string
	initialName: string
	initialDefinition: WorkflowDefinition
	onRunNavigate: (runId: string) => void
}) {
	const editor = useWorkflowEditor({
		workflowId,
		workflowName: initialName,
		initial: initialDefinition,
	})

	const handleRun = async () => {
		// Auto-save first so the run uses the latest definition
		if (editor.isDirty) {
			await editor.save()
		}
		try {
			const run = await triggerRun(workflowId)
			toast.success(`Run started: ${run.id.slice(0, 8)}`)
			onRunNavigate(run.id)
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to start run")
		}
	}

	return (
		// Use -m-6 to negate the layout's p-6, giving the editor a full-bleed canvas
		<div className="-m-6 flex flex-col" style={{ height: "calc(100vh - 3rem)" }}>
			<WorkflowEditorToolbar
				name={editor.name}
				onNameChange={(n) => {
					editor.setName(n)
					editor.markDirty()
				}}
				isDirty={editor.isDirty}
				saving={editor.saving}
				onSave={() => void editor.save()}
				onRun={() => void handleRun()}
				onAiGenerate={() => editor.setAiPanelOpen(true)}
			/>

			<div className="flex flex-1 overflow-hidden">
				<NodeLibrary />

				<div className="flex-1 overflow-hidden">
					<WorkflowCanvas
						nodes={editor.nodes}
						edges={editor.edges}
						onNodesChange={(changes) => {
							editor.onNodesChange(changes)
							editor.markDirty()
						}}
						onEdgesChange={(changes) => {
							editor.onEdgesChange(changes)
							editor.markDirty()
						}}
						onConnect={editor.onConnect}
						onNodeClick={(id) => editor.setSelectedNodeId(id)}
						onPaneClick={() => editor.setSelectedNodeId(null)}
						onAddNode={editor.addNode}
					/>
				</div>

				{editor.selectedNode && (
					<NodeConfigPanel
						node={editor.selectedNode}
						onUpdate={(data) => editor.updateNodeData(editor.selectedNodeId!, data)}
					/>
				)}
			</div>

			<AiGeneratePanel
				open={editor.aiPanelOpen}
				onOpenChange={editor.setAiPanelOpen}
				onGenerate={editor.runAiGenerate}
			/>
		</div>
	)
}
