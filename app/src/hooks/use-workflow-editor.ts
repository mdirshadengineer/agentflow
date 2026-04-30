import {
	addEdge,
	type Connection,
	useEdgesState,
	useNodesState,
} from "@xyflow/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { aiGenerateWorkflow, updateWorkflow } from "@/lib/api/workflows"
import type {
	WorkflowDefinition,
	WorkflowEdge,
	WorkflowNode,
	WorkflowNodeType,
} from "@/types/workflow"

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
	const savingRef = useRef(false)

	// Keep a stable ref to the latest state so the autosave timer never captures
	// stale closures and doesn't cause the effect to re-register on every render.
	const latestRef = useRef({ workflowId, name, nodes, edges })
	useEffect(() => {
		latestRef.current = { workflowId, name, nodes, edges }
	})

	const onConnect = useCallback(
		(connection: Connection) => {
			setEdges((eds) => {
				// Auto-label edges from condition node handles ("true"/"false")
				const label =
					connection.sourceHandle === "true" ||
					connection.sourceHandle === "false"
						? connection.sourceHandle
						: undefined
				const edge: WorkflowEdge = {
					...connection,
					id: crypto.randomUUID(),
					...(label && { label }),
				}
				return addEdge(edge, eds)
			})
			setIsDirty(true)
		},
		[setEdges],
	)

	const markDirty = useCallback(() => setIsDirty(true), [])

	const save = useCallback(async (): Promise<void> => {
		if (savingRef.current) return
		savingRef.current = true
		setSaving(true)
		try {
			const { workflowId: id, name: n, nodes: nds, edges: eds } =
				latestRef.current
			const definition: WorkflowDefinition = {
				nodes: nds as WorkflowNode[],
				edges: eds,
			}
			await updateWorkflow(id, { name: n, definition })
			setIsDirty(false)
			toast.success("Workflow saved")
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to save workflow",
			)
		} finally {
			setSaving(false)
			savingRef.current = false
		}
	}, [])

	// Auto-save when dirty — uses stable `save` so the timer never double-fires
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

	/** Delete a node and all edges connected to it. */
	const deleteNode = useCallback(
		(nodeId: string) => {
			setNodes((nds) => nds.filter((n) => n.id !== nodeId))
			setEdges((eds) =>
				eds.filter((e) => e.source !== nodeId && e.target !== nodeId),
			)
			setSelectedNodeId((id) => (id === nodeId ? null : id))
			setIsDirty(true)
		},
		[setNodes, setEdges],
	)

	/** Load a starter Trigger → Agent → Output skeleton onto the canvas. */
	const loadTemplate = useCallback(() => {
		const triggerId = crypto.randomUUID()
		const agentId = crypto.randomUUID()
		const outputId = crypto.randomUUID()
		const templateNodes: WorkflowNode[] = [
			{
				id: triggerId,
				type: "trigger",
				position: { x: 200, y: 80 },
				data: { label: "Trigger", triggerType: "manual" },
			},
			{
				id: agentId,
				type: "agent",
				position: { x: 200, y: 220 },
				data: { label: "Agent", agentId: "" },
			},
			{
				id: outputId,
				type: "output",
				position: { x: 200, y: 360 },
				data: { label: "Output" },
			},
		]
		const templateEdges: WorkflowEdge[] = [
			{
				id: crypto.randomUUID(),
				source: triggerId,
				target: agentId,
			},
			{
				id: crypto.randomUUID(),
				source: agentId,
				target: outputId,
			},
		]
		setNodes(templateNodes)
		setEdges(templateEdges)
		setIsDirty(true)
	}, [setNodes, setEdges])

	const updateNodeData = useCallback(
		(nodeId: string, data: Record<string, unknown>) => {
			setNodes((nds) =>
				nds.map((n) =>
					n.id === nodeId
						? ({ ...n, data: { ...n.data, ...data } } as WorkflowNode)
						: n,
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
		deleteNode,
		loadTemplate,
		updateNodeData,
		applyAiDefinition,
		runAiGenerate,
	}
}
