import { createFileRoute } from "@tanstack/react-router"
import { ReactFlowProvider, useReactFlow } from "@xyflow/react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { AiGeneratePanel } from "@/components/workflow-editor/AiGeneratePanel"
import { NodeConfigModal } from "@/components/workflow-editor/NodeConfigModal"
import { NodeLibrary } from "@/components/workflow-editor/NodeLibrary"
import { RunTerminalPanel } from "@/components/workflow-editor/RunTerminalPanel"
import { WorkflowCanvas } from "@/components/workflow-editor/WorkflowCanvas"
import { WorkflowEditorToolbar } from "@/components/workflow-editor/WorkflowEditorToolbar"
import { useWorkflowEditor } from "@/hooks/use-workflow-editor"
import { getWorkflow, triggerRun } from "@/lib/api/workflows"
import type { WorkflowDefinition } from "@/types/workflow"

export const Route = createFileRoute(
	"/_authenticated/workflows_/$workflowId/edit"
)({
	component: WorkflowEditorPage,
})

const EMPTY_DEFINITION: WorkflowDefinition = { nodes: [], edges: [] }

function WorkflowEditorPage() {
	const { workflowId } = Route.useParams()
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
				setLoadError(
					err instanceof Error ? err.message : "Failed to load workflow"
				)
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
				<Skeleton className="h-100 w-full" />
			</div>
		)
	}

	return (
		<ReactFlowProvider>
			<EditorInner
				workflowId={workflowId}
				initialName={initialName}
				initialDefinition={initialDefinition}
			/>
		</ReactFlowProvider>
	)
}

function EditorInner({
	workflowId,
	initialName,
	initialDefinition,
}: {
	workflowId: string
	initialName: string
	initialDefinition: WorkflowDefinition
}) {
	const editor = useWorkflowEditor({
		workflowId,
		workflowName: initialName,
		initial: initialDefinition,
	})

	const [showMiniMap, setShowMiniMap] = useState(true)
	const [activeRunId, setActiveRunId] = useState<string | null>(null)
	const { fitView } = useReactFlow()
	// Ref to the canvas wrapper div — shared with NodeLibrary for click-to-add centering
	const canvasRef = useRef<HTMLDivElement>(null)

	// ── Keyboard shortcuts ────────────────────────────────────────────────────
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ctrl+S / Cmd+S — save
			if ((e.ctrlKey || e.metaKey) && e.key === "s") {
				e.preventDefault()
				void editor.save()
				return
			}
			// Delete / Backspace — remove selected node (only when no input is focused)
			if (
				(e.key === "Delete" || e.key === "Backspace") &&
				editor.selectedNodeId !== null &&
				!(e.target instanceof HTMLInputElement) &&
				!(e.target instanceof HTMLTextAreaElement)
			) {
				editor.deleteNode(editor.selectedNodeId)
			}
		}
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [editor])

	const handleRun = async () => {
		// Auto-save first so the run uses the latest definition
		if (editor.isDirty) {
			await editor.save()
		}
		try {
			const run = await triggerRun(workflowId)
			toast.success(`Run started: ${run.id.slice(0, 8)}`)
			setActiveRunId(run.id)
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to start run")
		}
	}

	return (
		// Use -m-6 to negate the layout's p-6, giving the editor a full-bleed canvas
		<div
			className="-m-6 flex flex-col"
			style={{ height: "calc(100vh - 3rem)" }}
		>
			<WorkflowEditorToolbar
				workflowId={workflowId}
				name={editor.name}
				onNameChange={(n) => {
					editor.setName(n)
					editor.markDirty()
				}}
				isDirty={editor.isDirty}
				saving={editor.saving}
				nodeCount={editor.nodes.length}
				edgeCount={editor.edges.length}
				showMiniMap={showMiniMap}
				onToggleMiniMap={() => setShowMiniMap((v) => !v)}
				onFitView={() => fitView({ padding: 0.1 })}
				onSave={() => void editor.save()}
				onRun={() => void handleRun()}
				onAiGenerate={() => editor.setAiPanelOpen(true)}
				validationErrors={editor.validate()}
			/>

			<div className="flex flex-1 overflow-hidden">
				<NodeLibrary onAddNode={editor.addNode} canvasRef={canvasRef} />

				<div ref={canvasRef} className="flex flex-1 flex-col overflow-hidden">
					<WorkflowCanvas
						nodes={editor.nodes}
						edges={editor.edges}
						showMiniMap={showMiniMap}
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
						onLoadTemplate={editor.loadTemplate}
					/>

					{/* Embedded run terminal — slides in when a run is active */}
					{activeRunId && (
						<RunTerminalPanel
							runId={activeRunId}
							onClose={() => setActiveRunId(null)}
						/>
					)}
				</div>

				{editor.selectedNode && (
					<NodeConfigModal
						node={editor.selectedNode}
						open={editor.selectedNode !== null}
						onUpdate={(data) =>
							editor.updateNodeData(editor.selectedNodeId!, data)
						}
						onClose={() => editor.setSelectedNodeId(null)}
						onDelete={(id) => editor.deleteNode(id)}
						allNodes={editor.nodes}
						edges={editor.edges}
						workflowId={workflowId}
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
