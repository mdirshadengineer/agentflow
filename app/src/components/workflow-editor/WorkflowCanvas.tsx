import {
	Background,
	Controls,
	MiniMap,
	type NodeMouseHandler,
	ReactFlow,
	type ReactFlowInstance,
} from "@xyflow/react"
import { useCallback, useState } from "react"
import "@xyflow/react/dist/style.css"
import type { Connection, EdgeChange, NodeChange } from "@xyflow/react"
import type { WorkflowEdge, WorkflowNode } from "@/types/workflow"
import { AgentNode } from "./nodes/AgentNode"
import { ConditionNode } from "./nodes/ConditionNode"
import { GenericNode } from "./nodes/GenericNode"
import { OutputNode } from "./nodes/OutputNode"
import { TriggerNode } from "./nodes/TriggerNode"

const NODE_TYPES = {
	trigger: TriggerNode,
	agent: AgentNode,
	condition: ConditionNode,
	output: OutputNode,
	generic: GenericNode,
} as const

interface WorkflowCanvasProps {
	nodes: WorkflowNode[]
	edges: WorkflowEdge[]
	onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void
	onEdgesChange: (changes: EdgeChange[]) => void
	onConnect: (connection: Connection) => void
	onNodeClick: (nodeId: string) => void
	onPaneClick: () => void
	onAddNode: (type: string, position: { x: number; y: number }) => void
}

export function WorkflowCanvas({
	nodes,
	edges,
	onNodesChange,
	onEdgesChange,
	onConnect,
	onNodeClick,
	onPaneClick,
	onAddNode,
}: WorkflowCanvasProps) {
	// Capture the RF instance via onInit so we can call screenToFlowPosition on drop
	const [rfInstance, setRfInstance] = useState<ReactFlowInstance<
		WorkflowNode,
		WorkflowEdge
	> | null>(null)

	const handleNodeClick: NodeMouseHandler = useCallback(
		(_event, node) => {
			onNodeClick(node.id)
		},
		[onNodeClick]
	)

	const onDragOver = useCallback((event: React.DragEvent) => {
		event.preventDefault()
		event.dataTransfer.dropEffect = "move"
	}, [])

	const onDrop = useCallback(
		(event: React.DragEvent) => {
			event.preventDefault()
			const nodeType = event.dataTransfer.getData(
				"application/agentflow-node-type"
			)
			if (!nodeType || !rfInstance) return
			const position = rfInstance.screenToFlowPosition({
				x: event.clientX,
				y: event.clientY,
			})
			onAddNode(nodeType, position)
		},
		[rfInstance, onAddNode]
	)

	return (
		<ReactFlow
			nodes={nodes}
			edges={edges}
			nodeTypes={NODE_TYPES}
			onNodesChange={onNodesChange}
			onEdgesChange={onEdgesChange}
			onConnect={onConnect}
			onNodeClick={handleNodeClick}
			onPaneClick={onPaneClick}
			onDragOver={onDragOver}
			onDrop={onDrop}
			onInit={setRfInstance}
			fitView
			proOptions={{ hideAttribution: false }}
		>
			<Background />
			<Controls />
			<MiniMap nodeStrokeWidth={3} zoomable pannable />
		</ReactFlow>
	)
}
