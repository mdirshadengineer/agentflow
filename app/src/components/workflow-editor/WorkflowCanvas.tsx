import { useCallback, useState } from "react"
import {
	Background,
	Controls,
	MiniMap,
	ReactFlow,
	type NodeMouseHandler,
	type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { TriggerNode } from "./nodes/TriggerNode"
import { AgentNode } from "./nodes/AgentNode"
import { ConditionNode } from "./nodes/ConditionNode"
import { OutputNode } from "./nodes/OutputNode"
import type { WorkflowNode, WorkflowEdge, WorkflowNodeType } from "@/types/workflow"
import type { EdgeChange, NodeChange, Connection } from "@xyflow/react"

const NODE_TYPES = {
	trigger: TriggerNode,
	agent: AgentNode,
	condition: ConditionNode,
	output: OutputNode,
} as const

interface WorkflowCanvasProps {
	nodes: WorkflowNode[]
	edges: WorkflowEdge[]
	onNodesChange: (changes: NodeChange[]) => void
	onEdgesChange: (changes: EdgeChange[]) => void
	onConnect: (connection: Connection) => void
	onNodeClick: (nodeId: string) => void
	onPaneClick: () => void
	onAddNode: (type: WorkflowNodeType, position: { x: number; y: number }) => void
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
	const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)

	const handleNodeClick: NodeMouseHandler = useCallback(
		(_event, node) => {
			onNodeClick(node.id)
		},
		[onNodeClick],
	)

	const onDragOver = useCallback((event: React.DragEvent) => {
		event.preventDefault()
		event.dataTransfer.dropEffect = "move"
	}, [])

	const onDrop = useCallback(
		(event: React.DragEvent) => {
			event.preventDefault()
			const nodeType = event.dataTransfer.getData(
				"application/agentflow-node-type",
			) as WorkflowNodeType
			if (!nodeType || !rfInstance) return
			const position = rfInstance.screenToFlowPosition({
				x: event.clientX,
				y: event.clientY,
			})
			onAddNode(nodeType, position)
		},
		[rfInstance, onAddNode],
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
