/**
 * NodeConfigModal — n8n-style full-width node configuration dialog.
 *
 * Layout: three columns
 *   • Input   – upstream connected nodes + their output schema preview
 *   • Config  – label + type-specific config fields (NodeFormBody)
 *   • Output  – "Test step" button + live test result
 */
import {
	AlertTriangleIcon,
	BookOpenIcon,
	BotIcon,
	BoxIcon,
	CheckCircle2Icon,
	FlagIcon,
	GitBranchIcon,
	Loader2Icon,
	PlayIcon,
	SlidersHorizontalIcon,
	Trash2Icon,
	XCircleIcon,
	XIcon,
	ZapIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { type Agent, listAgents } from "@/lib/api/agents"
import { listNodes, type NodeManifest } from "@/lib/api/nodes"
import { type NodeTestOutput, testNode } from "@/lib/api/workflows"
import { cn } from "@/lib/utils"
import type { WorkflowEdge, WorkflowNode } from "@/types/workflow"
import {
	hasMandatoryUnset,
	NodeFormBody,
	TestResultPanel,
} from "./NodeConfigForm"

// ── Icon helpers ───────────────────────────────────────────────────────────────

const NODE_TYPE_ICONS: Record<string, React.ElementType> = {
	trigger: ZapIcon,
	agent: BotIcon,
	condition: GitBranchIcon,
	output: FlagIcon,
	generic: BoxIcon,
}

const NODE_TYPE_COLORS: Record<string, string> = {
	trigger: "bg-green-500/10 border-green-500/30 text-green-600",
	agent: "bg-blue-500/10 border-blue-500/30 text-blue-600",
	condition: "bg-amber-500/10 border-amber-500/30 text-amber-600",
	output: "bg-purple-500/10 border-purple-500/30 text-purple-600",
	generic: "bg-gray-500/10 border-gray-500/30 text-gray-600",
}

// ── Input panel ────────────────────────────────────────────────────────────────

function InputPanel({
	node,
	allNodes,
	edges,
	manifests,
}: {
	node: WorkflowNode
	allNodes: WorkflowNode[]
	edges: WorkflowEdge[]
	manifests: NodeManifest[]
}) {
	// Find nodes that connect TO this node (direct upstream)
	const upstreamIds = new Set(
		edges.filter((e) => e.target === node.id).map((e) => e.source)
	)
	const upstreamNodes = allNodes.filter((n) => upstreamIds.has(n.id))

	if (upstreamNodes.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-2 text-center p-4">
				<ZapIcon className="size-6 text-muted-foreground/30" />
				<p className="text-xs text-muted-foreground">
					No upstream nodes connected.
				</p>
				<p className="text-[10px] text-muted-foreground/70">
					Connect a node to this one to see its output here.
				</p>
			</div>
		)
	}

	return (
		<div className="space-y-3">
			{upstreamNodes.map((upstream) => {
				const upstreamType =
					upstream.type === "generic"
						? ((upstream.data as { nodeType?: string }).nodeType ?? "generic")
						: upstream.type
				const upstreamLabel =
					(upstream.data as { label?: string }).label ??
					upstreamType.charAt(0).toUpperCase() + upstreamType.slice(1)
				const manifest = manifests.find((m) => m.type === upstreamType)
				const TypeIcon = NODE_TYPE_ICONS[upstream.type] ?? BoxIcon
				const colorCls =
					NODE_TYPE_COLORS[upstream.type] ?? NODE_TYPE_COLORS.generic

				const outputProps = manifest?.outputSchema
					? Object.entries(
							(
								manifest.outputSchema as {
									properties?: Record<
										string,
										{ type?: string; description?: string }
									>
								}
							).properties ?? {}
						)
					: []

				return (
					<div
						key={upstream.id}
						className="rounded-lg border bg-muted/30 overflow-hidden"
					>
						{/* Upstream node header */}
						<div className="flex items-center gap-2 px-3 py-2 border-b bg-background">
							<div
								className={cn(
									"size-5 shrink-0 flex items-center justify-center rounded border",
									colorCls
								)}
							>
								<TypeIcon className="size-3" />
							</div>
							<span className="text-[11px] font-medium truncate">
								{upstreamLabel}
							</span>
							<span className="text-[10px] text-muted-foreground ml-auto shrink-0">
								{upstreamType}
							</span>
						</div>

						{/* Output schema fields */}
						{outputProps.length > 0 ? (
							<div className="px-3 py-2 space-y-1">
								{outputProps.map(([key, schema]) => (
									<div key={key} className="flex items-start gap-1.5">
										<code className="text-[10px] font-mono text-primary/70 shrink-0">
											{key}
										</code>
										<span className="text-[10px] text-muted-foreground/60 italic">
											{schema.type ?? "any"}
										</span>
										{schema.description && (
											<span className="text-[10px] text-muted-foreground ml-auto text-right leading-tight">
												{schema.description}
											</span>
										)}
									</div>
								))}
								<p className="text-[9px] text-muted-foreground/50 pt-1">
									Reference via{" "}
									<code className="font-mono">{"{{ nodeId.field }}"}</code>
								</p>
							</div>
						) : (
							<p className="px-3 py-2 text-[10px] text-muted-foreground">
								No output schema defined.
							</p>
						)}
					</div>
				)
			})}
		</div>
	)
}

// ── Output panel ───────────────────────────────────────────────────────────────

function OutputPanel({
	node,
	manifests,
	workflowId,
}: {
	node: WorkflowNode
	manifests: NodeManifest[]
	workflowId?: string
}) {
	const [testing, setTesting] = useState(false)
	const [testResult, setTestResult] = useState<NodeTestOutput | null>(null)

	// Reset when node changes
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
		<div className="flex flex-col gap-3 h-full">
			{!isBuiltIn && workflowId && (
				<Button
					variant="default"
					size="sm"
					className="w-full gap-1.5 text-xs"
					onClick={() => void handleTestStep()}
					disabled={testing || hasRequiredUnset}
					title={
						hasRequiredUnset
							? "Fill in required fields before testing"
							: "Test this step with the current config"
					}
				>
					{testing ? (
						<Loader2Icon className="size-3 animate-spin" />
					) : (
						<PlayIcon className="size-3" />
					)}
					{testing ? "Running…" : "Execute node"}
				</Button>
			)}

			{isBuiltIn && (
				<p className="text-[10px] text-muted-foreground">
					Built-in nodes cannot be tested individually.
				</p>
			)}

			{hasRequiredUnset && (
				<div className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[10px] text-amber-700 dark:text-amber-400">
					<AlertTriangleIcon className="size-3 shrink-0 mt-0.5" />
					Fill in all required fields to enable testing.
				</div>
			)}

			{testResult && (
				<div className="flex-1 overflow-y-auto">
					<div
						className={cn(
							"flex items-center gap-1.5 text-[10px] font-semibold mb-1.5",
							testResult.status === "success"
								? "text-green-600"
								: "text-red-500"
						)}
					>
						{testResult.status === "success" ? (
							<CheckCircle2Icon className="size-3 shrink-0" />
						) : (
							<XCircleIcon className="size-3 shrink-0" />
						)}
						{testResult.status === "success" ? "Success" : "Failed"}
					</div>
					<TestResultPanel testResult={testResult} />
				</div>
			)}

			{!testResult && !hasRequiredUnset && !isBuiltIn && (
				<div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
					<PlayIcon className="size-6 text-muted-foreground/30" />
					<p className="text-[10px] text-muted-foreground">
						Click "Execute node" to run this node and see its output here.
					</p>
				</div>
			)}
		</div>
	)
}

// ── NodeConfigModal ────────────────────────────────────────────────────────────

interface NodeConfigModalProps {
	node: WorkflowNode | null
	open: boolean
	onClose: () => void
	onUpdate: (data: Record<string, unknown>) => void
	onDelete: (nodeId: string) => void
	allNodes?: WorkflowNode[]
	edges?: WorkflowEdge[]
	workflowId?: string
}

export function NodeConfigModal({
	node,
	open,
	onClose,
	onUpdate,
	onDelete,
	allNodes = [],
	edges = [],
	workflowId,
}: NodeConfigModalProps) {
	const [agents, setAgents] = useState<Agent[]>([])
	const [manifests, setManifests] = useState<NodeManifest[]>([])
	const [paramTab, setParamTab] = useState<"parameters" | "description">(
		"parameters"
	)

	useEffect(() => {
		listAgents()
			.then(setAgents)
			.catch((err) => {
				console.error("NodeConfigModal: failed to load agents", err)
			})
	}, [])

	useEffect(() => {
		listNodes()
			.then(setManifests)
			.catch((err) => {
				console.error("NodeConfigModal: failed to load node manifests", err)
			})
	}, [])

	// Reset tab when node changes
	useEffect(() => {
		setParamTab("parameters")
	}, [node?.id])

	if (!node) return null

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
	const colorCls = NODE_TYPE_COLORS[node.type] ?? NODE_TYPE_COLORS.generic

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

	const handleDelete = () => {
		onDelete(node.id)
		onClose()
	}

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent
				showCloseButton={false}
				className="sm:max-w-5xl w-[90vw] p-0 overflow-hidden gap-0"
			>
				{/* Modal header */}
				<DialogHeader className="flex-row items-center gap-3 px-4 py-3 border-b shrink-0 bg-muted/20">
					<div
						className={cn(
							"size-8 shrink-0 flex items-center justify-center rounded-lg border-2",
							colorCls
						)}
					>
						<TypeIcon className="size-4" />
					</div>
					<div className="flex-1 min-w-0">
						<DialogTitle className="text-sm font-semibold truncate leading-tight">
							{nodeLabel}
						</DialogTitle>
						<p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
							{manifestType} node
							{manifest?.description && (
								<span className="ml-1.5 text-muted-foreground/60">
									— {manifest.description}
								</span>
							)}
						</p>
					</div>
					<div className="flex items-center gap-2 ml-auto">
						<Button
							variant="ghost"
							size="sm"
							className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-7 px-2"
							onClick={handleDelete}
						>
							<Trash2Icon className="size-3" />
							Delete
						</Button>
						<div className="w-px h-4 bg-border" />
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={onClose}
							className="size-7 text-muted-foreground hover:text-foreground"
						>
							<XIcon className="size-4" />
							<span className="sr-only">Close</span>
						</Button>
					</div>
				</DialogHeader>

				{/* Three-column body */}
				<div className="grid grid-cols-[1fr_1.6fr_1fr] divide-x overflow-hidden h-[80vh]">
					{/* ── Column 1: Input ── */}
					<div className="flex flex-col overflow-hidden">
						<div className="px-4 py-2.5 border-b bg-muted/20 shrink-0 flex items-center gap-2">
							<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Input
							</p>
							<p className="text-[9px] text-muted-foreground/50 mt-px">
								Data flowing into this node
							</p>
						</div>
						<div className="flex-1 overflow-y-auto p-3">
							<InputPanel
								node={node}
								allNodes={allNodes}
								edges={edges}
								manifests={manifests}
							/>
						</div>
					</div>

					{/* ── Column 2: Parameters / Description tabs ── */}
					<div className="flex flex-col overflow-hidden">
						{/* Tab header */}
						<div className="px-1 pt-1 border-b bg-muted/20 shrink-0 flex items-end gap-0">
							<button
								type="button"
								onClick={() => setParamTab("parameters")}
								className={cn(
									"flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-colors border-b-2 -mb-px",
									paramTab === "parameters"
										? "text-primary border-primary"
										: "text-muted-foreground border-transparent hover:text-foreground"
								)}
							>
								<SlidersHorizontalIcon className="size-3" />
								Parameters
							</button>
							{manifest?.description && (
								<button
									type="button"
									onClick={() => setParamTab("description")}
									className={cn(
										"flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-colors border-b-2 -mb-px",
										paramTab === "description"
											? "text-primary border-primary"
											: "text-muted-foreground border-transparent hover:text-foreground"
									)}
								>
									<BookOpenIcon className="size-3" />
									Docs
								</button>
							)}
						</div>
						<div className="flex-1 overflow-y-auto p-3">
							{paramTab === "parameters" ? (
								<NodeFormBody
									node={node}
									manifest={manifest}
									agents={agents}
									allNodes={allNodes}
									onUpdate={handleUpdate}
								/>
							) : (
								<div className="prose prose-sm max-w-none">
									<p className="text-xs text-muted-foreground leading-relaxed">
										{manifest?.description}
									</p>
									{manifest?.configSchema?.properties &&
										Object.keys(manifest.configSchema.properties).length >
											0 && (
											<div className="mt-4 space-y-2">
												<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
													Configuration fields
												</p>
												{Object.entries(manifest.configSchema.properties).map(
													([key, prop]) => (
														<div
															key={key}
															className="rounded-md border bg-muted/30 px-3 py-2"
														>
															<div className="flex items-center gap-1.5">
																<code className="text-[10px] font-mono text-primary">
																	{key}
																</code>
																<span className="text-[9px] text-muted-foreground/60 bg-muted rounded px-1">
																	{prop.type ?? "string"}
																</span>
																{manifest.configSchema.required?.includes(
																	key
																) && (
																	<span className="text-[9px] text-destructive font-medium">
																		required
																	</span>
																)}
															</div>
															{prop.description && (
																<p className="text-[10px] text-muted-foreground mt-1">
																	{prop.description}
																</p>
															)}
														</div>
													)
												)}
											</div>
										)}
								</div>
							)}
						</div>
					</div>

					{/* ── Column 3: Output ── */}
					<div className="flex flex-col overflow-hidden">
						<div className="px-4 py-2.5 border-b bg-muted/20 shrink-0 flex items-center gap-2">
							<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Output
							</p>
							<p className="text-[9px] text-muted-foreground/50 mt-px">
								Test result & data preview
							</p>
						</div>
						<div className="flex-1 overflow-y-auto p-3">
							<OutputPanel
								node={node}
								manifests={manifests}
								workflowId={workflowId}
							/>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
