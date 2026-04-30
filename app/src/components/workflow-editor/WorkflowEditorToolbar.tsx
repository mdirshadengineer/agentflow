import { Link } from "@tanstack/react-router"
import {
	ArrowLeftIcon,
	HistoryIcon,
	MapIcon,
	MaximizeIcon,
	PlayIcon,
	SaveIcon,
	SparklesIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface WorkflowEditorToolbarProps {
	workflowId: string
	name: string
	onNameChange: (name: string) => void
	isDirty: boolean
	saving: boolean
	nodeCount: number
	edgeCount: number
	showMiniMap: boolean
	onToggleMiniMap: () => void
	onFitView: () => void
	onSave: () => void
	onRun: () => void
	onAiGenerate: () => void
}

export function WorkflowEditorToolbar({
	workflowId,
	name,
	onNameChange,
	isDirty,
	saving,
	nodeCount,
	edgeCount,
	showMiniMap,
	onToggleMiniMap,
	onFitView,
	onSave,
	onRun,
	onAiGenerate,
}: WorkflowEditorToolbarProps) {
	return (
		<div className="flex items-center gap-2 shrink-0 border-b bg-background px-3 h-12">
			<Button variant="ghost" size="icon-sm" asChild>
				<Link to="/workflows">
					<ArrowLeftIcon />
					<span className="sr-only">Back to workflows</span>
				</Link>
			</Button>

			<div className="flex items-center gap-1.5 flex-1 min-w-0">
				<Input
					value={name}
					onChange={(e) => onNameChange(e.target.value)}
					className="h-7 text-sm font-medium border-transparent bg-transparent px-1 hover:border-input focus:border-input w-60"
				/>
				{isDirty && (
					<Badge variant="outline" className="text-xs shrink-0">
						Unsaved
					</Badge>
				)}
				<span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
					{nodeCount} node{nodeCount !== 1 ? "s" : ""} ·{" "}
					{edgeCount} edge{edgeCount !== 1 ? "s" : ""}
				</span>
			</div>

			<div className="flex items-center gap-1.5 ml-auto">
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onFitView}
					title="Fit view (zoom to fit all nodes)"
				>
					<MaximizeIcon className="size-3.5" />
					<span className="sr-only">Fit view</span>
				</Button>
				<Button
					variant={showMiniMap ? "secondary" : "ghost"}
					size="icon-sm"
					onClick={onToggleMiniMap}
					title="Toggle minimap"
				>
					<MapIcon className="size-3.5" />
					<span className="sr-only">Toggle minimap</span>
				</Button>
				<Button variant="ghost" size="icon-sm" asChild title="View run history">
					<Link
						to="/workflows/$workflowId/runs"
						params={{ workflowId }}
					>
						<HistoryIcon className="size-3.5" />
						<span className="sr-only">Run history</span>
					</Link>
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={onAiGenerate}
					className="gap-1.5"
				>
					<SparklesIcon className="size-3.5" />
					AI Generate
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={onSave}
					disabled={saving}
					title="Save (Ctrl+S)"
					className="gap-1.5"
				>
					<SaveIcon className="size-3.5" />
					{saving ? "Saving…" : "Save"}
				</Button>
				<Button size="sm" onClick={onRun} className="gap-1.5">
					<PlayIcon className="size-3.5" />
					Run
				</Button>
			</div>
		</div>
	)
}
