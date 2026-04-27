import { ArrowLeftIcon, PlayIcon, SaveIcon, SparklesIcon } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface WorkflowEditorToolbarProps {
	name: string
	onNameChange: (name: string) => void
	isDirty: boolean
	saving: boolean
	onSave: () => void
	onRun: () => void
	onAiGenerate: () => void
}

export function WorkflowEditorToolbar({
	name,
	onNameChange,
	isDirty,
	saving,
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
			</div>

			<div className="flex items-center gap-1.5 ml-auto">
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
