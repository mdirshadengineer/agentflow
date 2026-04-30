import {
	Background,
	BaseEdge,
	Controls,
	EdgeLabelRenderer,
	getBezierPath,
	MiniMap,
	type NodeMouseHandler,
	ReactFlow,
	type ReactFlowInstance,
} from "@xyflow/react"
import { useCallback, useState } from "react"
import "@xyflow/react/dist/style.css"
import type { Connection, EdgeChange, EdgeProps, NodeChange } from "@xyflow/react"
import { LayoutTemplateIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { WorkflowEdge, WorkflowNode } from "@/types/workflow"
import { AgentNode } from "./nodes/AgentNode"
import { ConditionNode } from "./nodes/ConditionNode"
import { GenericNode } from "./nodes/GenericNode"
import { OutputNode } from "./nodes/OutputNode"
import { TriggerNode } from "./nodes/TriggerNode"

// ── Labeled edge ──────────────────────────────────────────────────────────────

function LabeledEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	label,
	style,
	markerEnd,
}: EdgeProps) {
	const [edgePath, labelX, labelY] = getBezierPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
	})

	const isTrue = label === "true"
	const isFalse = label === "false"
	const hasLabel = Boolean(label)

	return (
		<>
			<BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
			{hasLabel && (
				<EdgeLabelRenderer>
					<span
						style={{
							transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
							pointerEvents: "all",
						}}
						className={[
							"absolute text-[9px] font-semibold px-1.5 py-0.5 rounded-full border",
							isTrue
								? "bg-green-500/10 text-green-700 border-green-500/30"
								: isFalse
									? "bg-red-500/10 text-red-600 border-red-500/30"
									: "bg-muted text-muted-foreground border-border",
							"nodrag nopan",
						].join(" ")}
					>
						{String(label)}
					</span>
				</EdgeLabelRenderer>
			)}
		</>
	)
}

const NODE_TYPES = {
	trigger: TriggerNode,
	agent: AgentNode,
	condition: ConditionNode,
	output: OutputNode,
	generic: GenericNode,
} as const

const EDGE_TYPES = { default: LabeledEdge } as const

interface WorkflowCanvasProps {
	nodes: WorkflowNode[]
	edges: WorkflowEdge[]
	showMiniMap: boolean
	onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void
	onEdgesChange: (changes: EdgeChange[]) => void
	onConnect: (connection: Connection) => void
	onNodeClick: (nodeId: string) => void
	onPaneClick: () => void
	onAddNode: (type: string, position: { x: number; y: number }) => void
	onLoadTemplate: () => void
	onRfInit?: (instance: ReactFlowInstance<WorkflowNode, WorkflowEdge>) => void
}

export function WorkflowCanvas({
	nodes,
	edges,
	showMiniMap,
	onNodesChange,
	onEdgesChange,
	onConnect,
	onNodeClick,
	onPaneClick,
	onAddNode,
	onLoadTemplate,
	onRfInit,
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
			)
			if (!nodeType || !rfInstance) return
			const position = rfInstance.screenToFlowPosition({
				x: event.clientX,
				y: event.clientY,
			})
			onAddNode(nodeType, position)
		},
		[rfInstance, onAddNode],
	)

	const handleInit = useCallback(
		(instance: ReactFlowInstance<WorkflowNode, WorkflowEdge>) => {
			setRfInstance(instance)
			onRfInit?.(instance)
		},
		[onRfInit],
	)

	const isEmpty = nodes.length === 0

	return (
		<div className="relative size-full">
			<ReactFlow
				nodes={nodes}
				edges={edges}
				nodeTypes={NODE_TYPES}
				edgeTypes={EDGE_TYPES}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onConnect={onConnect}
				onNodeClick={handleNodeClick}
				onPaneClick={onPaneClick}
				onDragOver={onDragOver}
				onDrop={onDrop}
				onInit={handleInit}
				fitView
				proOptions={{ hideAttribution: false }}
			>
				<Background />
				<Controls />
				{showMiniMap && <MiniMap nodeStrokeWidth={3} zoomable pannable />}
			</ReactFlow>

			{/* Empty canvas call-to-action */}
			{isEmpty && (
				<div
					className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none"
					aria-label="Empty canvas"
				>
					<p className="text-sm text-muted-foreground text-center max-w-xs">
						Drag a node from the left panel or click a node type to start
						building.
					</p>
					<Button
						variant="outline"
						size="sm"
						className="pointer-events-auto gap-1.5"
						onClick={onLoadTemplate}
					>
						<LayoutTemplateIcon className="size-3.5" />
						Start from template
					</Button>
				</div>
			)}
		</div>
	)
}
