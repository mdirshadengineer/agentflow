import { useState } from "react"
import { SparklesIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel } from "@/components/ui/field"

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

	const handleGenerate = async () => {
		if (!prompt.trim()) return
		setError(null)
		setLoading(true)
		try {
			await onGenerate(prompt.trim())
			onOpenChange(false)
			setPrompt("")
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
						Describe your workflow in plain English and let AI generate the nodes
						and connections for you. Review the result before saving.
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
