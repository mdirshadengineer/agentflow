import type { Node } from "@xyflow/react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface InspectorPanelProps {
	selectedNode: Node | null
	onUpdateNode: (id: string, data: Record<string, unknown>) => void
	onDeleteNode: (id: string) => void
	className?: string
}

export function InspectorPanel({
	selectedNode,
	onUpdateNode,
	onDeleteNode,
	className,
}: InspectorPanelProps) {
	if (!selectedNode) {
		return (
			<div
				className={cn(
					"flex flex-col items-center justify-center border-neutral-700 border-l bg-neutral-900 p-4 text-center",
					className
				)}
			>
				<p className="text-[11px] text-neutral-500">
					Select a node to inspect its properties
				</p>
			</div>
		)
	}

	const data = selectedNode.data as Record<string, unknown>

	const handleChange = (key: string, value: string) => {
		onUpdateNode(selectedNode.id, { ...data, [key]: value })
	}

	// Generic field renderers
	const fields: Array<{ key: string; label: string }> = Object.keys(data)
		.filter((k) => k !== "status")
		.map((k) => ({
			key: k,
			label: k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
		}))

	return (
		<div
			className={cn(
				"flex flex-col gap-3 overflow-y-auto border-neutral-700 border-l bg-neutral-900 p-3",
				className
			)}
		>
			<div className="flex items-center justify-between">
				<p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
					Properties
				</p>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={() => onDeleteNode(selectedNode.id)}
					className="text-red-400 hover:bg-red-400/10 hover:text-red-300"
					title="Delete node"
				>
					<Trash2 />
				</Button>
			</div>

			<div className="rounded-lg border border-neutral-700/60 bg-neutral-800/40 px-2.5 py-1.5">
				<p className="text-[10px] text-neutral-500">Type</p>
				<p className="text-xs font-medium text-neutral-200 capitalize">
					{selectedNode.type}
				</p>
			</div>

			{fields.map(({ key, label }) => (
				<div key={key} className="flex flex-col gap-1">
					<label className="text-[10px] text-neutral-500">{label}</label>
					<Input
						value={String(data[key] ?? "")}
						onChange={(e) => handleChange(key, e.target.value)}
						className="border-neutral-700 bg-neutral-800 text-neutral-100 text-xs"
					/>
				</div>
			))}
		</div>
	)
}
