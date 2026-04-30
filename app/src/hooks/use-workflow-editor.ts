import {
addEdge,
type Connection,
useEdgesState,
useNodesState,
} from "@xyflow/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { type NodeManifest, listNodes } from "@/lib/api/nodes"
import { aiGenerateWorkflow, updateWorkflow } from "@/lib/api/workflows"
import type {
GenericNodeData,
WorkflowDefinition,
WorkflowEdge,
WorkflowNode,
WorkflowNodeType,
} from "@/types/workflow"
import { hasMandatoryUnset } from "@/components/workflow-editor/NodeConfigForm"

const AUTOSAVE_DELAY_MS = 2000

export interface WorkflowValidationError {
message: string
}

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
const [manifests, setManifests] = useState<NodeManifest[]>([])
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

// Fetch node manifests once on mount
useEffect(() => {
listNodes()
.then(setManifests)
.catch(() => {})
}, [])

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

// Handle trigger variants encoded as "trigger-manual" / "trigger-scheduled" / "trigger-webhook"
let rfType = type
let data: object

if (type === "trigger-manual" || type === "trigger-scheduled" || type === "trigger-webhook") {
const triggerType = type.replace("trigger-", "") as "manual" | "scheduled" | "webhook"
rfType = "trigger"
data = { label: "Trigger", triggerType }
} else {
const knownDefaults: Record<WorkflowNodeType, object> = {
trigger: { label: "Trigger", triggerType: "manual" },
agent: { label: "Agent", agentId: "" },
condition: { label: "Condition", condition: "output.result === true" },
output: { label: "Output" },
}
const isKnown = type in knownDefaults
rfType = isKnown ? type : "generic"
if (isKnown) {
data = knownDefaults[type as WorkflowNodeType]
} else {
// Generic node: compute initial _hasRequiredUnset
const manifest = manifests.find((m) => m.type === type)
const initialData: GenericNodeData = { label: type, nodeType: type }
if (manifest) {
initialData._hasRequiredUnset = hasMandatoryUnset(
manifest.configSchema,
initialData as Record<string, unknown>
)
}
data = initialData
}
}

const newNode = {
id,
type: rfType,
position,
data,
}
setNodes((nds) => [...nds, newNode as WorkflowNode])
setIsDirty(true)
},
[setNodes, manifests],
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

/** Validate the workflow and return a list of error messages. */
const validate = useCallback((): WorkflowValidationError[] => {
const errors: WorkflowValidationError[] = []

// 1. Must have at least one trigger node
const triggerNodes = nodes.filter((n) => n.type === "trigger")
if (triggerNodes.length === 0) {
errors.push({ message: "Add a trigger node to start the workflow" })
}

// 2. Trigger nodes should not have incoming edges
for (const trigger of triggerNodes) {
const hasIncoming = edges.some((e) => e.target === trigger.id)
if (hasIncoming) {
const label =
(trigger.data as { label?: string }).label ?? "Trigger"
errors.push({
message: `Trigger "${label}" should not have incoming connections`,
})
}
}

// 3. Generic nodes with missing required fields
const missingNodes = nodes.filter(
(n) =>
n.type === "generic" &&
(n.data as GenericNodeData)._hasRequiredUnset === true,
)
if (missingNodes.length > 0) {
const names = missingNodes
.map(
(n) =>
(n.data as GenericNodeData).label ??
(n.data as GenericNodeData).nodeType ??
n.id.slice(0, 8),
)
.join(", ")
errors.push({ message: `Required fields missing on: ${names}` })
}

return errors
}, [nodes, edges])

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
manifests,
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
validate,
}
}
