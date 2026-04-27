import { useCallback, useEffect, useRef, useState } from "react"
import {
	addEdge,
	type Connection,
	useEdgesState,
	useNodesState,
} from "@xyflow/react"
import { toast } from "sonner"
import { aiGenerateWorkflow, updateWorkflow } from "@/lib/api/workflows"
import type { WorkflowDefinition, WorkflowNode, WorkflowNodeType } from "@/types/workflow"

const AUTOSAVE_DELAY_MS = 2000

interface UseWorkflowEditorOptions {
	workflowId: string
	workflowName: string
	initial: WorkflowDefinition
}

export function useWorkflowEditor({
	workflowId,
	workflowName,
	initial,
}: UseWorkflowEditorOptions) {
	const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes)
	const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)
	const [name, setName] = useState(workflowName)
	const [isDirty, setIsDirty] = useState(false)
	const [saving, setSaving] = useState(false)
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
	const [aiPanelOpen, setAiPanelOpen] = useState(false)
	const autosaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	)

	const onConnect = useCallback(
		(connection: Connection) => {
			setEdges((eds) => addEdge(connection, eds))
			setIsDirty(true)
		},
		[setEdges],
	)

	const markDirty = useCallback(() => setIsDirty(true), [])

	const save = useCallback(async (): Promise<void> => {
		setSaving(true)
		try {
			const definition: WorkflowDefinition = { nodes: nodes as WorkflowNode[], edges }
			await updateWorkflow(workflowId, { name, definition })
			setIsDirty(false)
			toast.success("Workflow saved")
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to save workflow")
		} finally {
			setSaving(false)
		}
	}, [workflowId, name, nodes, edges])

	// Auto-save when dirty
	useEffect(() => {
		if (!isDirty) return
		if (autosaveTimer.current !== undefined) {
			clearTimeout(autosaveTimer.current)
		}
		autosaveTimer.current = setTimeout(() => {
			void save()
		}, AUTOSAVE_DELAY_MS)
		return () => {
			if (autosaveTimer.current !== undefined) {
				clearTimeout(autosaveTimer.current)
			}
		}
	}, [isDirty, save])

	const addNode = useCallback(
		(type: string, position: { x: number; y: number }) => {
			const id = crypto.randomUUID()
			const knownDefaults: Record<WorkflowNodeType, object> = {
				trigger: { label: "Trigger", triggerType: "manual" },
				agent: { label: "Agent", agentId: "" },
				condition: { label: "Condition", condition: "output.result === true" },
				output: { label: "Output" },
			}
			const isKnown = type in knownDefaults
			const rfType = isKnown ? type : "generic"
			const data = isKnown
				? knownDefaults[type as WorkflowNodeType]
				: { label: type, nodeType: type }
			const newNode = {
				id,
				type: rfType,
				position,
				data,
			}
			setNodes((nds) => [...nds, newNode as WorkflowNode])
			setIsDirty(true)
		},
		[setNodes],
	)

	const updateNodeData = useCallback(
		(nodeId: string, data: Record<string, unknown>) => {
			setNodes((nds) =>
				nds.map((n) =>
					n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n,
				),
			)
			setIsDirty(true)
		},
		[setNodes],
	)

	const applyAiDefinition = useCallback(
		(definition: WorkflowDefinition) => {
			setNodes(definition.nodes)
			setEdges(definition.edges)
			setIsDirty(true)
		},
		[setNodes, setEdges],
	)

	const runAiGenerate = useCallback(
		async (prompt: string): Promise<void> => {
			const definition = await aiGenerateWorkflow(workflowId, prompt)
			applyAiDefinition(definition)
			toast.success("AI workflow generated — review and save")
		},
		[workflowId, applyAiDefinition],
	)

	const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null

	return {
		nodes,
		edges,
		name,
		setName,
		isDirty,
		saving,
		selectedNodeId,
		setSelectedNodeId,
		selectedNode,
		aiPanelOpen,
		setAiPanelOpen,
		onNodesChange,
		onEdgesChange,
		onConnect,
		markDirty,
		save,
		addNode,
		updateNodeData,
		applyAiDefinition,
		runAiGenerate,
	}
}
