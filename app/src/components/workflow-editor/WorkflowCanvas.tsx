import {
	Background,
	BackgroundVariant,
	Controls,
	type Edge,
	MiniMap,
	type Node,
	ReactFlow,
	ReactFlowProvider,
	type XYPosition,
} from "@xyflow/react"
import { useCallback, useEffect, useRef, useState } from "react"
import "@xyflow/react/dist/style.css"

import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable"
import type { WorkflowNodeType } from "@/hooks/use-workflow"
import { useWorkflow } from "@/hooks/use-workflow"
import { EdgeContextMenu } from "./EdgeContextMenu"
import { InspectorPanel } from "./InspectorPanel"
import { NodePanel } from "./NodePanel"
import { ActionNode } from "./nodes/ActionNode"
import { AgentNode } from "./nodes/AgentNode"
import { ConditionNode } from "./nodes/ConditionNode"
import { OutputNode } from "./nodes/OutputNode"
import { TriggerNode } from "./nodes/TriggerNode"
import { WorkflowToolbar } from "./WorkflowToolbar"

// ---------------------------------------------------------------------------
// Node type registry
// ---------------------------------------------------------------------------

const nodeTypes = {
	trigger: TriggerNode,
	action: ActionNode,
	agent: AgentNode,
	condition: ConditionNode,
	output: OutputNode,
} as const

// ---------------------------------------------------------------------------
// Inner canvas (must be inside ReactFlowProvider)
// ---------------------------------------------------------------------------

function Canvas({ workflowId }: { workflowId?: string }) {
	const {
		nodes,
		edges,
		onNodesChange,
		onEdgesChange,
		onConnect,
		addNode,
		undo,
		redo,
		workflowName,
		setWorkflowName,
		saveWorkflow,
		isSaving,
		loadWorkflow,
		setNodes,
	} = useWorkflow(workflowId)

	const [showMiniMap, setShowMiniMap] = useState(true)
	const [selectedNode, setSelectedNode] = useState<Node | null>(null)
	const [edgeMenu, setEdgeMenu] = useState<{
		edgeId: string
		x: number
		y: number
	} | null>(null)
	const reactFlowWrapper = useRef<HTMLDivElement>(null)

	// Load workflow if id provided
	useEffect(() => {
		if (workflowId) {
			loadWorkflow(workflowId)
		}
	}, [workflowId, loadWorkflow])

	// -----------------------------------------------------------------------
	// Drag-and-drop from NodePanel
	// -----------------------------------------------------------------------

	const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault()
		e.dataTransfer.dropEffect = "copy"
	}, [])

	const onDrop = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			e.preventDefault()
			const type = e.dataTransfer.getData(
				"application/workflow-node-type"
			) as WorkflowNodeType
			if (!type) return

			const bounds = reactFlowWrapper.current?.getBoundingClientRect()
			if (!bounds) return

			const position: XYPosition = {
				x: e.clientX - bounds.left,
				y: e.clientY - bounds.top,
			}
			addNode(type, position)
		},
		[addNode]
	)

	// -----------------------------------------------------------------------
	// Inspector: sync selected node
	// -----------------------------------------------------------------------

	const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
		setSelectedNode(node)
	}, [])

	const onPaneClick = useCallback(() => {
		setSelectedNode(null)
	}, [])

	const onUpdateNode = useCallback(
		(id: string, data: Record<string, unknown>) => {
			setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data } : n)))
			setSelectedNode((prev) => (prev?.id === id ? { ...prev, data } : prev))
		},
		[setNodes]
	)

	const onDeleteNode = useCallback(
		(id: string) => {
			setNodes((nds) => nds.filter((n) => n.id !== id))
			setSelectedNode(null)
		},
		[setNodes]
	)

	// -----------------------------------------------------------------------
	// Edge context menu
	// -----------------------------------------------------------------------

	const onEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
		e.preventDefault()
		setEdgeMenu({ edgeId: edge.id, x: e.clientX, y: e.clientY })
	}, [])

	const onDeleteEdge = useCallback(
		(id: string) => {
			setEdges((eds) => eds.filter((e) => e.id !== id))
		},
		[setEdges]
	)

	const onAddConditionToEdge = useCallback(
		(id: string) => {
			const edge = edges.find((e) => e.id === id)
			if (!edge) return
			const sourceNode = nodes.find((n) => n.id === edge.source)
			const targetNode = nodes.find((n) => n.id === edge.target)
			const midX =
				sourceNode && targetNode
					? (sourceNode.position.x + targetNode.position.x) / 2
					: 200
			const midY =
				sourceNode && targetNode
					? (sourceNode.position.y + targetNode.position.y) / 2
					: 200
			addNode("condition", { x: midX, y: midY })
		},
		[edges, nodes, addNode]
	)

	return (
		<div className="flex h-full flex-col bg-neutral-950">
			<WorkflowToolbar
				name={workflowName}
				onNameChange={setWorkflowName}
				onSave={saveWorkflow}
				onUndo={undo}
				onRedo={redo}
				isSaving={isSaving}
				showMiniMap={showMiniMap}
				onToggleMiniMap={() => setShowMiniMap((v) => !v)}
			/>

			<ResizablePanelGroup direction="horizontal" className="flex-1">
				{/* Left panel — node palette */}
				<ResizablePanel defaultSize={15} minSize={12} maxSize={25}>
					<NodePanel className="h-full" />
				</ResizablePanel>

				<ResizableHandle withHandle />

				{/* Centre — canvas */}
				<ResizablePanel defaultSize={65}>
					<div
						ref={reactFlowWrapper}
						className="h-full w-full"
						onDragOver={onDragOver}
						onDrop={onDrop}
					>
						<ReactFlow
							nodes={nodes}
							edges={edges}
							nodeTypes={nodeTypes}
							onNodesChange={onNodesChange}
							onEdgesChange={onEdgesChange}
							onConnect={onConnect}
							onNodeClick={onNodeClick}
							onPaneClick={onPaneClick}
							onEdgeContextMenu={onEdgeContextMenu}
							fitView
							deleteKeyCode="Delete"
							className="workflow-canvas"
							colorMode="dark"
						>
							<Background
								variant={BackgroundVariant.Dots}
								gap={20}
								size={1}
								color="#333"
							/>
							<Controls className="workflow-controls" />
							{showMiniMap && (
								<MiniMap
									nodeColor="#334155"
									maskColor="rgba(0,0,0,0.6)"
									className="workflow-minimap"
								/>
							)}
						</ReactFlow>
					</div>
				</ResizablePanel>

				<ResizableHandle withHandle />

				{/* Right panel — inspector */}
				<ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
					<InspectorPanel
						selectedNode={selectedNode}
						onUpdateNode={onUpdateNode}
						onDeleteNode={onDeleteNode}
						className="h-full"
					/>
				</ResizablePanel>
			</ResizablePanelGroup>

			{edgeMenu && (
				<EdgeContextMenu
					x={edgeMenu.x}
					y={edgeMenu.y}
					edgeId={edgeMenu.edgeId}
					onDelete={onDeleteEdge}
					onAddCondition={onAddConditionToEdge}
					onClose={() => setEdgeMenu(null)}
				/>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------
// Public export — wraps with ReactFlowProvider
// ---------------------------------------------------------------------------

interface WorkflowCanvasProps {
	workflowId?: string
}

export function WorkflowCanvas({ workflowId }: WorkflowCanvasProps) {
	return (
		<ReactFlowProvider>
			<Canvas workflowId={workflowId} />
		</ReactFlowProvider>
	)
}
