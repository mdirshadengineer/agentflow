import {
	BotIcon,
	BoxIcon,
	FlagIcon,
	GitBranchIcon,
	Loader2Icon,
	PlayIcon,
	Trash2Icon,
	XIcon,
	ZapIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { type Agent, listAgents } from "@/lib/api/agents"
import { type NodeManifest, listNodes } from "@/lib/api/nodes"
import { type NodeTestOutput, testNode } from "@/lib/api/workflows"
import { cn } from "@/lib/utils"
import type { WorkflowNode } from "@/types/workflow"
import {
	NodeFormBody,
	TestResultPanel,
	hasMandatoryUnset,
} from "./NodeConfigForm"

const NODE_TYPE_ICONS: Record<string, React.ElementType> = {
	trigger: ZapIcon,
	agent: BotIcon,
	condition: GitBranchIcon,
	output: FlagIcon,
	generic: BoxIcon,
}

interface NodeConfigPanelProps {
	node: WorkflowNode
	onUpdate: (data: Record<string, unknown>) => void
	onClose: () => void
	onDelete: (nodeId: string) => void
	allNodes?: WorkflowNode[]
	workflowId?: string
}

export function NodeConfigPanel({
	node,
	onUpdate,
	onClose,
	onDelete,
	allNodes,
	workflowId,
}: NodeConfigPanelProps) {
	const [agents, setAgents] = useState<Agent[]>([])
	const [manifests, setManifests] = useState<NodeManifest[]>([])
	const [testing, setTesting] = useState(false)
	const [testResult, setTestResult] = useState<NodeTestOutput | null>(null)

	useEffect(() => {
		listAgents()
			.then(setAgents)
			.catch(() => {})
	}, [])

	useEffect(() => {
		listNodes()
			.then(setManifests)
			.catch(() => {})
	}, [])

	// Reset test result when selected node changes
	useEffect(() => {
		setTestResult(null)
	}, [node.id])

	const manifestType =
		node.type === "generic"
			? ((node.data as { nodeType?: string }).nodeType ?? node.type)
			: node.type
	const manifest = manifests.find((m) => m.type === manifestType)

	const isBuiltIn =
		node.type === "trigger" ||
		node.type === "agent" ||
		node.type === "condition" ||
		node.type === "output"

	const nodeLabel =
		(node.data as { label?: string }).label ||
		node.type.charAt(0).toUpperCase() + node.type.slice(1)

	const TypeIcon = NODE_TYPE_ICONS[node.type] ?? BoxIcon

	// Wrap onUpdate to keep _hasRequiredUnset in sync for generic nodes
	const handleUpdate = (patch: Record<string, unknown>) => {
		if (!isBuiltIn && manifest) {
			const newData = { ...node.data, ...patch } as Record<string, unknown>
			const hasUnset = hasMandatoryUnset(manifest.configSchema, newData)
			onUpdate({ ...patch, _hasRequiredUnset: hasUnset })
		} else {
			onUpdate(patch)
		}
	}

	const hasRequiredUnset =
		!isBuiltIn &&
		manifest != null &&
		hasMandatoryUnset(
			manifest.configSchema,
			node.data as Record<string, unknown>
		)

	const handleTestStep = async () => {
		if (!workflowId) return
		setTesting(true)
		setTestResult(null)
		try {
			const nodeType =
				node.type === "generic"
					? ((node.data as { nodeType?: string }).nodeType ?? "noop")
					: node.type
			const config = { ...node.data } as Record<string, unknown>
			delete config.label
			delete config.nodeType
			delete config._hasRequiredUnset
			const result = await testNode(workflowId, nodeType, config)
			setTestResult(result)
		} catch (err) {
			setTestResult({
				status: "failed",
				data: {},
				logs: err instanceof Error ? err.message : String(err),
			})
		} finally {
			setTesting(false)
		}
	}

	return (
		<aside className="w-72 shrink-0 border-l bg-background overflow-y-auto flex flex-col">
			{/* Header */}
			<div className="p-3 border-b flex items-start justify-between gap-1">
				<div className="flex items-center gap-2 min-w-0">
					<div
						className={cn(
							"size-7 shrink-0 flex items-center justify-center rounded-md border",
							node.type === "trigger" &&
								"bg-green-500/10 border-green-500/30 text-green-600",
							node.type === "agent" &&
								"bg-blue-500/10 border-blue-500/30 text-blue-600",
							node.type === "condition" &&
								"bg-amber-500/10 border-amber-500/30 text-amber-600",
							node.type === "output" &&
								"bg-purple-500/10 border-purple-500/30 text-purple-600",
							(node.type === "generic" || !NODE_TYPE_ICONS[node.type]) &&
								"bg-gray-500/10 border-gray-500/30 text-gray-600"
						)}
					>
						<TypeIcon className="size-3.5" />
					</div>
					<div className="min-w-0">
						<p className="text-xs font-semibold truncate">{nodeLabel}</p>
						<p className="text-[10px] text-muted-foreground">
							{manifestType} node
						</p>
					</div>
				</div>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onClose}
					title="Close panel"
					className="size-6 shrink-0"
				>
					<XIcon className="size-3" />
				</Button>
			</div>

			{/* Form */}
			<div className="p-3 flex-1">
				<NodeFormBody
					node={node}
					manifest={manifest}
					agents={agents}
					allNodes={allNodes}
					onUpdate={handleUpdate}
				/>
			</div>

			{/* Test result */}
			{testResult && (
				<div className="border-t">
					<TestResultPanel testResult={testResult} />
				</div>
			)}

			{/* Footer actions */}
			<div className="p-3 border-t flex flex-col gap-2">
				{!isBuiltIn && workflowId && (
					<Button
						variant="secondary"
						size="sm"
						className="w-full gap-1.5 text-xs"
						onClick={() => void handleTestStep()}
						disabled={testing || hasRequiredUnset}
						title={
							hasRequiredUnset
								? "Fill in required fields before testing"
								: "Test this step"
						}
					>
						{testing ? (
							<Loader2Icon className="size-3 animate-spin" />
						) : (
							<PlayIcon className="size-3" />
						)}
						{testing ? "Running…" : "Test step"}
					</Button>
				)}
				<Button
					variant="destructive"
					size="sm"
					className="w-full gap-1.5 text-xs"
					onClick={() => onDelete(node.id)}
				>
					<Trash2Icon className="size-3" />
					Delete node
				</Button>
			</div>
		</aside>
	)
}
