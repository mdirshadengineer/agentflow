import { useReactFlow } from "@xyflow/react"
import { Map, Maximize2, Minus, Plus, Redo2, Save, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface WorkflowToolbarProps {
	name: string
	onNameChange: (value: string) => void
	onSave: () => void
	onUndo: () => void
	onRedo: () => void
	isSaving?: boolean
	showMiniMap: boolean
	onToggleMiniMap: () => void
}

export function WorkflowToolbar({
	name,
	onNameChange,
	onSave,
	onUndo,
	onRedo,
	isSaving,
	showMiniMap,
	onToggleMiniMap,
}: WorkflowToolbarProps) {
	const { zoomIn, zoomOut, fitView } = useReactFlow()

	return (
		<div className="flex h-11 items-center gap-2 border-neutral-700 border-b bg-neutral-900/90 px-3 backdrop-blur-sm">
			{/* Workflow name */}
			<Input
				value={name}
				onChange={(e) => onNameChange(e.target.value)}
				className="h-6 w-44 border-neutral-700 bg-neutral-800 text-neutral-100 text-xs placeholder:text-neutral-500 focus-visible:border-sky-500"
				placeholder="Workflow name"
			/>

			<div className="mx-1 h-4 w-px bg-neutral-700" />

			{/* History */}
			<Button
				variant="ghost"
				size="icon-sm"
				onClick={onUndo}
				title="Undo"
				className="text-neutral-400 hover:text-neutral-100"
			>
				<Undo2 />
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				onClick={onRedo}
				title="Redo"
				className="text-neutral-400 hover:text-neutral-100"
			>
				<Redo2 />
			</Button>

			<div className="mx-1 h-4 w-px bg-neutral-700" />

			{/* Zoom */}
			<Button
				variant="ghost"
				size="icon-sm"
				onClick={() => zoomOut()}
				title="Zoom out"
				className="text-neutral-400 hover:text-neutral-100"
			>
				<Minus />
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				onClick={() => zoomIn()}
				title="Zoom in"
				className="text-neutral-400 hover:text-neutral-100"
			>
				<Plus />
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				onClick={() => fitView({ padding: 0.1 })}
				title="Fit view"
				className="text-neutral-400 hover:text-neutral-100"
			>
				<Maximize2 />
			</Button>

			<div className="mx-1 h-4 w-px bg-neutral-700" />

			{/* MiniMap toggle */}
			<Button
				variant="ghost"
				size="icon-sm"
				onClick={onToggleMiniMap}
				title="Toggle minimap"
				className={
					showMiniMap
						? "text-sky-400 hover:text-sky-300"
						: "text-neutral-400 hover:text-neutral-100"
				}
			>
				<Map />
			</Button>

			<div className="flex-1" />

			{/* Save */}
			<Button
				size="sm"
				onClick={onSave}
				disabled={isSaving}
				className="bg-sky-600 text-white hover:bg-sky-700"
			>
				<Save />
				{isSaving ? "Saving…" : "Save"}
			</Button>
		</div>
	)
}
