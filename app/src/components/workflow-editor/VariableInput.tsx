/**
 * VariableInput — a string/textarea input that shows an autocomplete popover
 * whenever the user types `{{`. Suggested variables are derived from upstream
 * workflow nodes and follow the pattern `{{ steps.<label>.output }}`.
 * When upstream node test-output data is provided the suggestions also include
 * dot-notation paths into the actual output object.
 */
import { useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { WorkflowNode } from "@/types/workflow"

// ── Helpers ────────────────────────────────────────────────────────────────────

const MAX_SUGGESTIONS = 20
const MAX_ARRAY_PREVIEW_ITEMS = 3
const MAX_STRING_HINT_LENGTH = 30

/** Build the base variable expression for a node. */
function nodeBaseVar(stepId: string): string {
	return `{{ steps.${stepId}.output }}`
}

/** Build a specific-path variable expression. */
function nodePathVar(stepId: string, path: string): string {
	return `{{ steps.${stepId}.output.${path} }}`
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

/**
 * Recursively flatten an object to dot-notation paths up to `maxDepth` levels.
 * Returns at most `maxItems` entries to keep the dropdown manageable.
 */
function flattenPaths(
	obj: unknown,
	prefix = "",
	depth = 2,
	results: Array<{ path: string; value: unknown }> = []
): Array<{ path: string; value: unknown }> {
	if (results.length >= MAX_SUGGESTIONS) return results
	if (depth === 0 || typeof obj !== "object" || obj === null) {
		if (prefix) results.push({ path: prefix, value: obj })
		return results
	}
	const entries = Array.isArray(obj)
		? (obj as unknown[])
				.slice(0, MAX_ARRAY_PREVIEW_ITEMS)
				.map((v, i) => [String(i), v] as const)
		: (Object.entries(obj as Record<string, unknown>) as [string, unknown][])
	for (const [k, v] of entries) {
		if (results.length >= MAX_SUGGESTIONS) break
		const newPath = prefix ? `${prefix}.${k}` : k
		results.push({ path: newPath, value: v })
		if (typeof v === "object" && v !== null && depth > 1) {
			flattenPaths(v, newPath, depth - 1, results)
		}
	}
	return results
}

/** Format a value for display as a hint next to the suggestion. */
function formatValueHint(value: unknown): string {
	if (value === null) return "null"
	if (value === undefined) return ""
	if (typeof value === "string") {
		return value.length > MAX_STRING_HINT_LENGTH
			? `"${value.slice(0, MAX_STRING_HINT_LENGTH)}…"`
			: `"${value}"`
	}
	if (typeof value === "object") {
		return Array.isArray(value)
			? `[${(value as unknown[]).length} items]`
			: "{…}"
	}
	return String(value)
}

export interface VariableSuggestion {
	node: WorkflowNode
	label: string
	variable: string
	/** Optional hint showing the actual value from a previous test run. */
	valueHint?: string
}

/** Suggestions filtered by what the user typed after `{{`. */
function getSuggestions(
	nodes: WorkflowNode[],
	value: string,
	cursorPos: number,
	upstreamOutputs?: Map<string, Record<string, unknown>>
): VariableSuggestion[] {
	const triggerIdx = findTrigger(value, cursorPos)
	if (triggerIdx === -1) return []
	const typed = value
		.slice(triggerIdx + 2, cursorPos)
		.trim()
		.toLowerCase()

	const suggestions: VariableSuggestion[] = []

	for (const n of nodes) {
		const lbl = (n.data as { label?: string }).label ?? n.id.slice(0, 8)
		const stepId = n.id
		const outputData = upstreamOutputs?.get(n.id)

		if (outputData && Object.keys(outputData).length > 0) {
			// Include the base expression (full output object)
			const baseVar = nodeBaseVar(stepId)
			if (typed === "" || baseVar.toLowerCase().includes(typed)) {
				suggestions.push({
					node: n,
					label: lbl,
					variable: baseVar,
					valueHint: "{…}",
				})
			}
			// Add one entry per flattened path in the output
			const paths = flattenPaths(outputData)
			for (const { path, value: pathVal } of paths) {
				const pathVar = nodePathVar(stepId, path)
				if (typed === "" || pathVar.toLowerCase().includes(typed)) {
					suggestions.push({
						node: n,
						label: lbl,
						variable: pathVar,
						valueHint: formatValueHint(pathVal),
					})
				}
			}
		} else {
			// No output data — fall back to the generic base expression
			const baseVar = nodeBaseVar(stepId)
			if (typed === "" || baseVar.toLowerCase().includes(typed)) {
				suggestions.push({ node: n, label: lbl, variable: baseVar })
			}
		}
	}

	return suggestions
}

// ── Component ──────────────────────────────────────────────────────────────────

interface VariableInputProps {
	value: string
	onChange: (v: string) => void
	upstreamNodes: WorkflowNode[]
	/** Map of nodeId → last test-output data (used to generate path suggestions). */
	upstreamOutputs?: Map<string, Record<string, unknown>>
	multiline?: boolean
	rows?: number
	placeholder?: string
	className?: string
}

export function VariableInput({
	value,
	onChange,
	upstreamNodes,
	upstreamOutputs,
	multiline = false,
	rows = 4,
	placeholder,
	className,
}: VariableInputProps) {
	// We need selectionStart / setSelectionRange which exist on both element types
	const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
	const [suggestions, setSuggestions] = useState<VariableSuggestion[]>([])
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
		setSuggestions(getSuggestions(upstreamNodes, val, cursor, upstreamOutputs))
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
					<ul className="py-1 max-h-52 overflow-y-auto text-xs">
						{suggestions.map(({ node, variable, valueHint }, idx) => (
							<li key={`${node.id}:${variable}`}>
								<button
									type="button"
									onMouseDown={(e) => {
										e.preventDefault()
										insertVariable(variable)
									}}
									className={cn(
										"w-full text-left px-3 py-1.5 hover:bg-accent hover:text-accent-foreground transition-colors",
										idx === selectedIdx && "bg-accent text-accent-foreground"
									)}
								>
									<span className="font-mono truncate block">{variable}</span>
									{valueHint && (
										<span className="text-[10px] text-muted-foreground/70 truncate block">
											{valueHint}
										</span>
									)}
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
