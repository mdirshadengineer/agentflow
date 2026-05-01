/**
 * VariableInput — a string/textarea input that shows an autocomplete popover
 * whenever the user types `{{`. Suggested variables are derived from upstream
 * workflow nodes and follow the pattern `{{ steps.<label>.output }}`.
 */
import { useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { WorkflowNode } from "@/types/workflow"

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build the variable expression for a node. */
function nodeVar(node: WorkflowNode): string {
	const label = (node.data as { label?: string }).label ?? node.id.slice(0, 8)
	return `{{ steps.${label}.output }}`
}

/** Find `{{` immediately before the cursor position in `value`. */
function findTrigger(value: string, cursorPos: number): number {
	const before = value.slice(0, cursorPos)
	const idx = before.lastIndexOf("{{")
	if (idx === -1) return -1
	// Only active if the `{{` hasn't been closed yet
	const afterBraces = before.slice(idx)
	if (afterBraces.includes("}}")) return -1
	return idx
}

/** Suggestions filtered by what the user typed after `{{`. */
function getSuggestions(
	nodes: WorkflowNode[],
	value: string,
	cursorPos: number
): { node: WorkflowNode; label: string; variable: string }[] {
	const triggerIdx = findTrigger(value, cursorPos)
	if (triggerIdx === -1) return []
	const typed = value
		.slice(triggerIdx + 2, cursorPos)
		.trim()
		.toLowerCase()
	return nodes
		.map((n) => {
			const lbl = (n.data as { label?: string }).label ?? n.id.slice(0, 8)
			return { node: n, label: lbl, variable: nodeVar(n) }
		})
		.filter(
			({ variable }) => typed === "" || variable.toLowerCase().includes(typed)
		)
}

// ── Component ──────────────────────────────────────────────────────────────────

interface VariableInputProps {
	value: string
	onChange: (v: string) => void
	upstreamNodes: WorkflowNode[]
	multiline?: boolean
	rows?: number
	placeholder?: string
	className?: string
}

export function VariableInput({
	value,
	onChange,
	upstreamNodes,
	multiline = false,
	rows = 4,
	placeholder,
	className,
}: VariableInputProps) {
	// We need selectionStart / setSelectionRange which exist on both element types
	const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
	const [suggestions, setSuggestions] = useState<
		{ node: WorkflowNode; label: string; variable: string }[]
	>([])
	const [selectedIdx, setSelectedIdx] = useState(0)
	const [triggerIdx, setTriggerIdx] = useState(-1)

	// Recompute suggestions on every value/cursor change
	const refreshSuggestions = (val: string, cursor: number) => {
		const idx = findTrigger(val, cursor)
		setTriggerIdx(idx)
		if (idx === -1 || upstreamNodes.length === 0) {
			setSuggestions([])
			return
		}
		setSuggestions(getSuggestions(upstreamNodes, val, cursor))
		setSelectedIdx(0)
	}

	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
	) => {
		const newVal = e.target.value
		onChange(newVal)
		refreshSuggestions(newVal, e.target.selectionStart ?? newVal.length)
	}

	const handleKeyDown = (
		e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
	) => {
		if (suggestions.length === 0) return
		if (e.key === "ArrowDown") {
			e.preventDefault()
			setSelectedIdx((i) => (i + 1) % suggestions.length)
		} else if (e.key === "ArrowUp") {
			e.preventDefault()
			setSelectedIdx((i) => (i - 1 + suggestions.length) % suggestions.length)
		} else if (e.key === "Enter" || e.key === "Tab") {
			const s = suggestions[selectedIdx]
			if (s) {
				e.preventDefault()
				insertVariable(s.variable)
			}
		} else if (e.key === "Escape") {
			setSuggestions([])
		}
	}

	const insertVariable = (variable: string) => {
		const el = inputRef.current
		if (!el) return
		const cursor = el.selectionStart ?? value.length
		const idx = triggerIdx === -1 ? findTrigger(value, cursor) : triggerIdx
		if (idx === -1) {
			onChange(value + variable)
			setSuggestions([])
			return
		}
		const before = value.slice(0, idx)
		const after = value.slice(cursor)
		const newVal = before + variable + after
		onChange(newVal)
		setSuggestions([])
		// Place cursor after inserted variable
		const newCursor = before.length + variable.length
		requestAnimationFrame(() => {
			el.setSelectionRange(newCursor, newCursor)
			el.focus()
		})
	}

	const open = suggestions.length > 0

	const sharedProps = {
		value,
		onChange: handleChange,
		onKeyDown: handleKeyDown,
		placeholder,
		className,
	}

	return (
		<div className="relative">
			{multiline ? (
				<Textarea
					{...sharedProps}
					ref={inputRef as React.RefObject<HTMLTextAreaElement>}
					rows={rows}
					className={cn("text-xs", className)}
				/>
			) : (
				<Input
					{...sharedProps}
					ref={inputRef as React.RefObject<HTMLInputElement>}
					className={cn("h-7 text-xs", className)}
				/>
			)}

			{open && (
				<div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md overflow-hidden">
					<ul className="py-1 max-h-44 overflow-y-auto text-xs">
						{suggestions.map(({ node, variable }, idx) => (
							<li key={node.id}>
								<button
									type="button"
									onMouseDown={(e) => {
										e.preventDefault()
										insertVariable(variable)
									}}
									className={cn(
										"w-full text-left px-3 py-1.5 font-mono truncate hover:bg-accent hover:text-accent-foreground transition-colors",
										idx === selectedIdx && "bg-accent text-accent-foreground"
									)}
								>
									{variable}
								</button>
							</li>
						))}
					</ul>
					<div className="px-3 py-1 border-t text-[10px] text-muted-foreground">
						↑↓ navigate · Enter/Tab insert · Esc close
					</div>
				</div>
			)}
		</div>
	)
}
