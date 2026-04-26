import {
	addEdge,
	applyEdgeChanges,
	applyNodeChanges,
	type Edge,
	type Node,
	type OnConnect,
	type OnEdgesChange,
	type OnNodesChange,
	type XYPosition,
} from "@xyflow/react"
import { useCallback, useRef, useState } from "react"

const API_BASE = "/api/v1/workflows"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkflowNodeType =
	| "trigger"
	| "action"
	| "agent"
	| "condition"
	| "output"

export type WorkflowGraph = {
	nodes: Node[]
	edges: Edge[]
}

export type WorkflowRecord = {
	id: string
	name: string
	description: string
	graph: WorkflowGraph
	createdAt: string
	updatedAt: string
}

// ---------------------------------------------------------------------------
// History helpers
// ---------------------------------------------------------------------------

type Snapshot = { nodes: Node[]; edges: Edge[] }

function useHistory(initial: Snapshot) {
	const past = useRef<Snapshot[]>([])
	const future = useRef<Snapshot[]>([])
	const current = useRef<Snapshot>(initial)

	const push = useCallback((snap: Snapshot) => {
		past.current.push(current.current)
		future.current = []
		current.current = snap
	}, [])

	const undo = useCallback((): Snapshot | null => {
		const prev = past.current.pop()
		if (!prev) return null
		future.current.push(current.current)
		current.current = prev
		return prev
	}, [])

	const redo = useCallback((): Snapshot | null => {
		const next = future.current.pop()
		if (!next) return null
		past.current.push(current.current)
		current.current = next
		return next
	}, [])

	return { push, undo, redo }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWorkflow(workflowId?: string) {
	const [nodes, setNodes] = useState<Node[]>([])
	const [edges, setEdges] = useState<Edge[]>([])
	const [workflowName, setWorkflowName] = useState("Untitled Workflow")
	const [workflowDescription, setWorkflowDescription] = useState("")
	const [isSaving, setIsSaving] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const history = useHistory({ nodes: [], edges: [] })
	const savedIdRef = useRef<string | undefined>(workflowId)

	// -----------------------------------------------------------------------
	// ReactFlow change handlers
	// -----------------------------------------------------------------------

	const onNodesChange: OnNodesChange = useCallback(
		(changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
		[]
	)

	const onEdgesChange: OnEdgesChange = useCallback(
		(changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
		[]
	)

	const onConnect: OnConnect = useCallback(
		(connection) =>
			setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
		[]
	)

	// -----------------------------------------------------------------------
	// Add node factory
	// -----------------------------------------------------------------------

	const addNode = useCallback(
		(type: WorkflowNodeType, position: XYPosition) => {
			const id = `${type}_${Date.now()}`
			const defaultData: Record<WorkflowNodeType, object> = {
				trigger: { label: "Trigger", triggerType: "manual" },
				action: { label: "Action", actionType: "http" },
				agent: { label: "Agent", agentName: "My Agent", model: "gpt-4o" },
				condition: { label: "Condition", condition: "value > 0" },
				output: { label: "Output", outputType: "log" },
			}
			const newNode: Node = {
				id,
				type,
				position,
				data: defaultData[type],
			}
			setNodes((nds) => {
				const next = [...nds, newNode]
				history.push({ nodes: next, edges })
				return next
			})
		},
		[edges, history]
	)

	// -----------------------------------------------------------------------
	// Undo / Redo
	// -----------------------------------------------------------------------

	const undo = useCallback(() => {
		const snap = history.undo()
		if (snap) {
			setNodes(snap.nodes)
			setEdges(snap.edges)
		}
	}, [history])

	const redo = useCallback(() => {
		const snap = history.redo()
		if (snap) {
			setNodes(snap.nodes)
			setEdges(snap.edges)
		}
	}, [history])

	// -----------------------------------------------------------------------
	// Persistence
	// -----------------------------------------------------------------------

	const loadWorkflow = useCallback(async (id: string) => {
		setIsLoading(true)
		setError(null)
		try {
			const res = await fetch(`${API_BASE}/${id}`)
			if (!res.ok) throw new Error(`Failed to load workflow: ${res.status}`)
			const data: WorkflowRecord = await res.json()
			setWorkflowName(data.name)
			setWorkflowDescription(data.description)
			const graph = data.graph ?? { nodes: [], edges: [] }
			setNodes(graph.nodes ?? [])
			setEdges(graph.edges ?? [])
			savedIdRef.current = id
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error")
		} finally {
			setIsLoading(false)
		}
	}, [])

	const saveWorkflow = useCallback(async () => {
		setIsSaving(true)
		setError(null)
		try {
			const body = {
				name: workflowName,
				description: workflowDescription,
				graph: { nodes, edges },
			}
			let res: Response
			if (savedIdRef.current) {
				res = await fetch(`${API_BASE}/${savedIdRef.current}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				})
			} else {
				res = await fetch(API_BASE, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				})
			}
			if (!res.ok) throw new Error(`Failed to save workflow: ${res.status}`)
			const data: WorkflowRecord = await res.json()
			savedIdRef.current = data.id
			return data
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error")
			return null
		} finally {
			setIsSaving(false)
		}
	}, [workflowName, workflowDescription, nodes, edges])

	return {
		// graph state
		nodes,
		edges,
		setNodes,
		setEdges,
		// change handlers
		onNodesChange,
		onEdgesChange,
		onConnect,
		// helpers
		addNode,
		undo,
		redo,
		// metadata
		workflowName,
		setWorkflowName,
		workflowDescription,
		setWorkflowDescription,
		// async
		loadWorkflow,
		saveWorkflow,
		isSaving,
		isLoading,
		error,
		savedId: savedIdRef.current,
	}
}
