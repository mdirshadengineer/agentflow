import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon, SendIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { Agent } from "@/lib/api/agents"
import { listTools, type ToolInfo } from "@/lib/api/tools"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_authenticated/agents/$agentId")({
	component: AgentDetailPage,
})

// ── SSE chat types ────────────────────────────────────────────────────────────

interface UserMessage {
	role: "user"
	content: string
}

interface AssistantMessage {
	role: "assistant"
	content: string
}

interface ToolCallMessage {
	role: "tool_call"
	name: string
	arguments: unknown
	result?: string
}

type ChatMessage = UserMessage | AssistantMessage | ToolCallMessage

// ── Page component ────────────────────────────────────────────────────────────

function AgentDetailPage() {
	const { agentId } = Route.useParams()
	const navigate = useNavigate()
	const [agent, setAgent] = useState<Agent | null>(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [tools, setTools] = useState<ToolInfo[]>([])

	// Form state
	const [name, setName] = useState("")
	const [type, setType] = useState("")
	const [description, setDescription] = useState("")
	const [llmProvider, setLlmProvider] = useState("")
	const [llmModel, setLlmModel] = useState("")
	const [systemPrompt, setSystemPrompt] = useState("")
	const [selectedTools, setSelectedTools] = useState<string[]>([])
	const [configText, setConfigText] = useState("{}")

	useEffect(() => {
		fetch(`/api/v1/agents/${agentId}`)
			.then((r) => {
				if (!r.ok) throw new Error("Not found")
				return r.json() as Promise<Agent>
			})
			.then((a) => {
				setAgent(a)
				setName(a.name)
				setType(a.type)
				setDescription(a.description ?? "")
				setLlmProvider(a.llmProvider ?? "")
				setLlmModel(a.llmModel ?? "")
				setSystemPrompt(a.systemPrompt ?? "")
				setSelectedTools(a.tools ?? [])
				setConfigText(JSON.stringify(a.config, null, 2))
			})
			.catch(() => toast.error("Failed to load agent"))
			.finally(() => setLoading(false))
	}, [agentId])

	useEffect(() => {
		listTools()
			.then(setTools)
			.catch(() => {
				// Tools are optional
			})
	}, [])

	const toggleTool = (toolName: string) => {
		setSelectedTools((prev) =>
			prev.includes(toolName) ? prev.filter((t) => t !== toolName) : [...prev, toolName],
		)
	}

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)

		let config: unknown
		try {
			config = JSON.parse(configText)
		} catch {
			setError("Config must be valid JSON")
			return
		}

		setSaving(true)
		try {
			const r = await fetch(`/api/v1/agents/${agentId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name,
					type,
					description: description || undefined,
					llmProvider: llmProvider || null,
					llmModel: llmModel || null,
					systemPrompt: systemPrompt || null,
					tools: selectedTools.length > 0 ? selectedTools : null,
					config,
				}),
			})
			if (!r.ok) {
				const body = (await r.json()) as { error: string }
				throw new Error(body.error)
			}
			const updated = (await r.json()) as Agent
			setAgent(updated)
			toast.success("Agent saved")
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save agent")
		} finally {
			setSaving(false)
		}
	}

	const handleDelete = async () => {
		if (!confirm(`Delete agent "${agent?.name}"? This cannot be undone.`)) return
		setDeleting(true)
		try {
			const r = await fetch(`/api/v1/agents/${agentId}`, { method: "DELETE" })
			if (!r.ok) throw new Error("Failed to delete")
			toast.success("Agent deleted")
			void navigate({ to: "/agents" })
		} catch {
			toast.error("Failed to delete agent")
			setDeleting(false)
		}
	}

	return (
		<div className="space-y-4 max-w-2xl">
			<div className="flex items-center gap-2">
				<Button variant="ghost" size="icon-sm" asChild>
					<Link to="/agents">
						<ArrowLeftIcon />
						<span className="sr-only">Back</span>
					</Link>
				</Button>
				<div>
					<h1 className="text-lg font-semibold">
						{loading ? "Loading…" : (agent?.name ?? "Agent")}
					</h1>
					<p className="text-muted-foreground text-xs">Edit agent settings.</p>
				</div>
			</div>

			{loading ? (
				<div className="space-y-3">
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-24 w-full" />
				</div>
			) : agent === null ? (
				<Card>
					<CardContent className="py-8 text-center text-xs text-muted-foreground">
						Agent not found.
					</CardContent>
				</Card>
			) : (
				<Tabs defaultValue="config">
					<TabsList>
						<TabsTrigger value="config">Config</TabsTrigger>
						<TabsTrigger value="chat">Chat</TabsTrigger>
					</TabsList>

					<TabsContent value="config">
						<Card>
							<CardHeader className="border-b pb-3">
								<CardTitle className="text-sm">Agent Details</CardTitle>
							</CardHeader>
							<CardContent className="pt-4">
								<form onSubmit={(e) => void handleSave(e)}>
									<FieldGroup>
										{error && (
											<p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
												{error}
											</p>
										)}
										<Field>
											<FieldLabel htmlFor="name">Name *</FieldLabel>
											<Input
												id="name"
												required
												value={name}
												onChange={(e) => setName(e.target.value)}
											/>
										</Field>
										<Field>
											<FieldLabel htmlFor="type">Type *</FieldLabel>
											<Input
												id="type"
												required
												value={type}
												onChange={(e) => setType(e.target.value)}
											/>
										</Field>
										<Field>
											<FieldLabel htmlFor="description">Description</FieldLabel>
											<Input
												id="description"
												value={description}
												onChange={(e) => setDescription(e.target.value)}
												placeholder="Optional description"
											/>
										</Field>
										<Field>
											<FieldLabel htmlFor="llmProvider">LLM Provider</FieldLabel>
											<Select
												value={llmProvider}
												onValueChange={setLlmProvider}
											>
												<SelectTrigger id="llmProvider">
													<SelectValue placeholder="Select provider…" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="openai">OpenAI</SelectItem>
													<SelectItem value="anthropic">Anthropic</SelectItem>
													<SelectItem value="ollama">Ollama</SelectItem>
												</SelectContent>
											</Select>
										</Field>
										<Field>
											<FieldLabel htmlFor="llmModel">LLM Model</FieldLabel>
											<Input
												id="llmModel"
												value={llmModel}
												onChange={(e) => setLlmModel(e.target.value)}
												placeholder="e.g. gpt-4o, claude-3-5-sonnet"
											/>
										</Field>
										<Field>
											<FieldLabel htmlFor="systemPrompt">System Prompt</FieldLabel>
											<Textarea
												id="systemPrompt"
												rows={4}
												value={systemPrompt}
												onChange={(e) => setSystemPrompt(e.target.value)}
												placeholder="You are a helpful assistant…"
											/>
										</Field>
										{tools.length > 0 && (
											<Field>
												<FieldLabel>Tools</FieldLabel>
												<div className="space-y-2 pt-1">
													{tools.map((tool) => (
														<div key={tool.name} className="flex items-start gap-2">
															<Checkbox
																id={`tool-${tool.name}`}
																checked={selectedTools.includes(tool.name)}
																onCheckedChange={() => toggleTool(tool.name)}
															/>
															<div>
																<Label
																	htmlFor={`tool-${tool.name}`}
																	className="text-xs font-medium cursor-pointer"
																>
																	{tool.name}
																</Label>
																{tool.description && (
																	<p className="text-[10px] text-muted-foreground">
																		{tool.description}
																	</p>
																)}
															</div>
														</div>
													))}
												</div>
											</Field>
										)}
										<Field>
											<FieldLabel htmlFor="config">Config (JSON)</FieldLabel>
											<Textarea
												id="config"
												rows={6}
												value={configText}
												onChange={(e) => setConfigText(e.target.value)}
												className="font-mono text-xs"
											/>
										</Field>
										<div className="flex gap-2 pt-2">
											<Button type="submit" disabled={saving}>
												{saving ? "Saving…" : "Save Changes"}
											</Button>
											<Button
												type="button"
												variant="destructive"
												disabled={deleting}
												onClick={() => void handleDelete()}
											>
												{deleting ? "Deleting…" : "Delete Agent"}
											</Button>
										</div>
									</FieldGroup>
								</form>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="chat">
						<ChatTab agentId={agentId} />
					</TabsContent>
				</Tabs>
			)}
		</div>
	)
}

// ── Chat tab ──────────────────────────────────────────────────────────────────

function ChatTab({ agentId }: { agentId: string }) {
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [inputText, setInputText] = useState("")
	const [sessionId, setSessionId] = useState<string | undefined>(undefined)
	const [streaming, setStreaming] = useState(false)
	const scrollRef = useRef<HTMLDivElement>(null)

	const scrollToBottom = () => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight
		}
	}

	const sendMessage = async () => {
		const message = inputText.trim()
		if (!message || streaming) return

		setInputText("")
		setMessages((prev) => [...prev, { role: "user", content: message }])
		setStreaming(true)

		try {
			const resp = await fetch(`/api/v1/agents/${agentId}/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message, sessionId }),
			})

			if (!resp.ok) {
				const body = (await resp.json()) as { error?: string }
				throw new Error(body.error ?? "Chat request failed")
			}

			if (!resp.body) {
				throw new Error("Response body is not readable")
			}

			const reader = resp.body.getReader()
			const decoder = new TextDecoder()
			let buffer = ""

			const processEvents = (raw: string) => {
				const events = raw.split("\n\n")
				for (const eventBlock of events) {
					if (!eventBlock.trim()) continue
					let eventType = ""
					let dataStr = ""
					for (const line of eventBlock.split("\n")) {
						if (line.startsWith("event:")) {
							eventType = line.slice(6).trim()
						} else if (line.startsWith("data:")) {
							dataStr = line.slice(5).trim()
						}
					}
					if (!eventType || !dataStr) continue
					try {
						const data = JSON.parse(dataStr) as Record<string, unknown>
						handleSseEvent(eventType, data)
					} catch {
						// ignore parse errors
					}
				}
			}

			const handleSseEvent = (type: string, data: Record<string, unknown>) => {
				if (type === "message") {
					setMessages((prev) => [
						...prev,
						{ role: "assistant", content: String(data.content ?? "") },
					])
					setTimeout(scrollToBottom, 0)
				} else if (type === "tool_call") {
					setMessages((prev) => [
						...prev,
						{
							role: "tool_call",
							name: String(data.name ?? ""),
							arguments: data.arguments,
						},
					])
					setTimeout(scrollToBottom, 0)
				} else if (type === "tool_result") {
					// Attach result to the last tool_call with matching name
					setMessages((prev) => {
						const next = [...prev]
						for (let i = next.length - 1; i >= 0; i--) {
							if (
								next[i].role === "tool_call" &&
								(next[i] as ToolCallMessage).name === data.name &&
								!(next[i] as ToolCallMessage).result
							) {
								next[i] = {
									...(next[i] as ToolCallMessage),
									result: String(data.result ?? ""),
								}
								break
							}
						}
						return next
					})
				} else if (type === "done") {
					if (data.sessionId) setSessionId(String(data.sessionId))
				} else if (type === "error") {
					toast.error(String(data.message ?? "Chat error"))
				}
			}

			while (true) {
				const { value, done } = await reader.read()
				if (done) break
				buffer += decoder.decode(value, { stream: true })
				const lastDoubleNewline = buffer.lastIndexOf("\n\n")
				if (lastDoubleNewline !== -1) {
					processEvents(buffer.slice(0, lastDoubleNewline + 2))
					buffer = buffer.slice(lastDoubleNewline + 2)
				}
			}
			// flush any remaining
			if (buffer.trim()) processEvents(buffer)
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Chat failed")
		} finally {
			setStreaming(false)
		}
	}

	return (
		<Card>
			<CardContent className="pt-4 flex flex-col gap-3">
				{/* Message list */}
				<div
					ref={scrollRef}
					className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1"
				>
					{messages.length === 0 && (
						<p className="text-xs text-muted-foreground text-center py-8">
							Send a message to start chatting with this agent.
						</p>
					)}
					{messages.map((msg, idx) => (
						<MessageBubble key={idx} message={msg} />
					))}
					{streaming && (
						<div className="flex justify-start">
							<div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground animate-pulse">
								Thinking…
							</div>
						</div>
					)}
				</div>

				{/* Input area */}
				<div className="flex gap-2 pt-1 border-t">
					<Textarea
						value={inputText}
						onChange={(e) => setInputText(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault()
								void sendMessage()
							}
						}}
						placeholder="Type a message… (Enter to send)"
						rows={2}
						className="text-xs resize-none flex-1"
						disabled={streaming}
					/>
					<Button
						size="icon"
						onClick={() => void sendMessage()}
						disabled={streaming || !inputText.trim()}
						className="self-end"
					>
						<SendIcon className="size-4" />
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}

function MessageBubble({ message }: { message: ChatMessage }) {
	const [open, setOpen] = useState(false)

	if (message.role === "user") {
		return (
			<div className="flex justify-end">
				<div className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs max-w-[80%]">
					{message.content}
				</div>
			</div>
		)
	}

	if (message.role === "assistant") {
		return (
			<div className="flex justify-start">
				<div className="rounded-lg bg-muted px-3 py-2 text-xs max-w-[80%] whitespace-pre-wrap">
					{message.content}
				</div>
			</div>
		)
	}

	// tool_call
	return (
		<div className="flex justify-start w-full">
			<Collapsible open={open} onOpenChange={setOpen} className="w-full max-w-[90%]">
				<CollapsibleTrigger asChild>
					<button
						type="button"
						className={cn(
							"flex items-center gap-1.5 w-full rounded-lg border px-3 py-2 text-xs",
							"bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
							"hover:bg-amber-500/15 transition-colors",
						)}
					>
						{open ? (
							<ChevronDownIcon className="size-3 shrink-0" />
						) : (
							<ChevronRightIcon className="size-3 shrink-0" />
						)}
						<span className="font-medium">Called:</span>
						<span className="font-mono">{message.name}(…)</span>
					</button>
				</CollapsibleTrigger>
				<CollapsibleContent className="mt-1 rounded-lg border bg-muted/50 px-3 py-2 text-xs font-mono space-y-1">
					<div>
						<span className="text-muted-foreground">args: </span>
						{JSON.stringify(message.arguments, null, 2)}
					</div>
					{message.result !== undefined && (
						<div>
							<span className="text-muted-foreground">result: </span>
							{message.result}
						</div>
					)}
				</CollapsibleContent>
			</Collapsible>
		</div>
	)
}
