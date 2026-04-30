import { SparklesIcon } from "lucide-react"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"

const MAX_HISTORY = 5

interface AiGeneratePanelProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onGenerate: (prompt: string) => Promise<void>
}

export function AiGeneratePanel({
	open,
	onOpenChange,
	onGenerate,
}: AiGeneratePanelProps) {
	const [prompt, setPrompt] = useState("")
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const historyRef = useRef<string[]>([])

	const handleGenerate = async () => {
		if (!prompt.trim()) return
		setError(null)
		setLoading(true)
		try {
			await onGenerate(prompt.trim())
			// Record in history (dedup + keep latest MAX_HISTORY)
			const trimmed = prompt.trim()
			historyRef.current = [
				trimmed,
				...historyRef.current.filter((h) => h !== trimmed),
			].slice(0, MAX_HISTORY)
			onOpenChange(false)
			// Do NOT clear the prompt so users can iterate
		} catch (err) {
			setError(err instanceof Error ? err.message : "Generation failed")
		} finally {
			setLoading(false)
		}
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						<SparklesIcon className="size-4" />
						AI Workflow Generator
					</SheetTitle>
					<SheetDescription>
						Describe your workflow in plain English and let AI generate the
						nodes and connections for you. Review the result before saving.
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto p-6">
					{error && (
						<p className="mb-3 rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
							{error}
						</p>
					)}
					<Field>
						<FieldLabel>Describe your workflow</FieldLabel>
						<Textarea
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							placeholder="e.g. When triggered manually, run the summariser agent on the input text, then check if the summary is longer than 100 words — if so, pass it to the shortener agent, otherwise send it straight to output."
							rows={8}
							className="text-xs"
							disabled={loading}
						/>
					</Field>

					{historyRef.current.length > 0 && (
						<div className="mt-3 space-y-1.5">
							<p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
								Recent prompts
							</p>
							{historyRef.current.map((h) => (
								<button
									key={h}
									type="button"
									onClick={() => setPrompt(h)}
									className="w-full text-left text-[10px] truncate rounded border px-2 py-1 bg-muted hover:bg-accent transition-colors"
									title={h}
								>
									{h}
								</button>
							))}
						</div>
					)}

					<p className="mt-3 text-[10px] text-muted-foreground">
						The generated workflow replaces the current canvas. You can still
						review and edit before clicking Save.
					</p>
				</div>

				<SheetFooter>
					<Button
						onClick={() => void handleGenerate()}
						disabled={loading || !prompt.trim()}
						className="w-full"
					>
						<SparklesIcon className="size-3.5 mr-1.5" />
						{loading ? "Generating…" : "Generate Workflow"}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	)
}
