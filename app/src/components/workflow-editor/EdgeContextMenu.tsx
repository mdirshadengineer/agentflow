import { GitBranch, Trash2 } from "lucide-react"

interface EdgeContextMenuProps {
	x: number
	y: number
	edgeId: string
	onDelete: (id: string) => void
	onAddCondition: (id: string) => void
	onClose: () => void
}

export function EdgeContextMenu({
	x,
	y,
	edgeId,
	onDelete,
	onAddCondition,
	onClose,
}: EdgeContextMenuProps) {
	const handleDelete = () => {
		onDelete(edgeId)
		onClose()
	}

	const handleAddCondition = () => {
		onAddCondition(edgeId)
		onClose()
	}

	return (
		<>
			{/* Backdrop */}
			<div className="fixed inset-0 z-40" onClick={onClose} />

			{/* Menu */}
			<div
				className="fixed z-50 min-w-[160px] overflow-hidden rounded-lg border border-neutral-700 bg-neutral-800 shadow-xl"
				style={{ top: y, left: x }}
			>
				<button
					type="button"
					className="flex w-full items-center gap-2 px-3 py-2 text-xs text-neutral-200 transition-colors hover:bg-neutral-700"
					onClick={handleAddCondition}
				>
					<GitBranch className="size-3.5 text-orange-400" />
					Add condition
				</button>
				<div className="h-px bg-neutral-700" />
				<button
					type="button"
					className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-400/10"
					onClick={handleDelete}
				>
					<Trash2 className="size-3.5" />
					Delete edge
				</button>
			</div>
		</>
	)
}
