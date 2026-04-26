import { createFileRoute, Link } from "@tanstack/react-router"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

export const Route = createFileRoute("/_authenticated/agents")({
	component: AgentsPage,
})

interface Agent {
	id: string
	name: string
	description: string | null
	type: string
	config: unknown
	createdAt: number
	updatedAt: number
}

async function fetchAgents(): Promise<Agent[]> {
	const r = await fetch("/api/v1/agents")
	if (!r.ok) throw new Error("Failed to fetch agents")
	return r.json() as Promise<Agent[]>
}

async function deleteAgent(id: string): Promise<void> {
	const r = await fetch(`/api/v1/agents/${id}`, { method: "DELETE" })
	if (!r.ok) throw new Error("Failed to delete agent")
}

function AgentsPage() {
	const [agents, setAgents] = useState<Agent[]>([])
	const [loading, setLoading] = useState(true)
	const [createOpen, setCreateOpen] = useState(false)

	const reload = () => {
		setLoading(true)
		fetchAgents()
			.then(setAgents)
			.catch(() => toast.error("Failed to load agents"))
			.finally(() => setLoading(false))
	}

	useEffect(reload, [])

	const handleDelete = async (id: string, name: string) => {
		if (!confirm(`Delete agent "${name}"?`)) return
		try {
			await deleteAgent(id)
			toast.success("Agent deleted")
			reload()
		} catch {
			toast.error("Failed to delete agent")
		}
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-lg font-semibold">Agents</h1>
					<p className="text-muted-foreground text-xs mt-1">
						Manage your AI agents.
					</p>
				</div>
				<Dialog open={createOpen} onOpenChange={setCreateOpen}>
					<DialogTrigger asChild>
						<Button size="sm">
							<PlusIcon />
							New Agent
						</Button>
					</DialogTrigger>
					<DialogContent>
						<CreateAgentForm
							onSuccess={() => {
								setCreateOpen(false)
								reload()
							}}
						/>
					</DialogContent>
				</Dialog>
			</div>

			{loading ? (
				<div className="space-y-2">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} className="h-16 w-full" />
					))}
				</div>
			) : agents.length === 0 ? (
				<Card>
					<CardContent className="py-8 text-center text-xs text-muted-foreground">
						No agents yet. Create your first agent to get started.
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{agents.map((agent) => (
						<Card key={agent.id} className="group">
							<CardHeader className="border-b pb-3">
								<div className="flex items-start justify-between gap-2">
									<CardTitle className="text-sm font-medium leading-snug">
										<Link
											to="/agents/$agentId"
											params={{ agentId: agent.id }}
											className="hover:underline"
										>
											{agent.name}
										</Link>
									</CardTitle>
									<Button
										variant="ghost"
										size="icon-xs"
										className="opacity-0 group-hover:opacity-100 transition-opacity"
										onClick={() => void handleDelete(agent.id, agent.name)}
									>
										<Trash2Icon />
										<span className="sr-only">Delete</span>
									</Button>
								</div>
							</CardHeader>
							<CardContent className="pt-3 space-y-1.5">
								{agent.description && (
									<p className="text-xs text-muted-foreground line-clamp-2">
										{agent.description}
									</p>
								)}
								<Badge variant="outline">{agent.type}</Badge>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	)
}

function CreateAgentForm({ onSuccess }: { onSuccess: () => void }) {
	const [name, setName] = useState("")
	const [type, setType] = useState("")
	const [description, setDescription] = useState("")
	const [configText, setConfigText] = useState("{}")
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)

		let config: unknown
		try {
			config = JSON.parse(configText)
		} catch {
			setError("Config must be valid JSON")
			return
		}

		setLoading(true)
		try {
			const r = await fetch("/api/v1/agents", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name,
					type,
					description: description || undefined,
					config,
				}),
			})
			if (!r.ok) {
				const body = (await r.json()) as { error: string }
				throw new Error(body.error)
			}
			toast.success("Agent created")
			onSuccess()
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create agent")
		} finally {
			setLoading(false)
		}
	}

	return (
		<form onSubmit={handleSubmit}>
			<DialogHeader>
				<DialogTitle>Create Agent</DialogTitle>
			</DialogHeader>
			<FieldGroup className="my-4">
				{error && (
					<p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{error}
					</p>
				)}
				<Field>
					<FieldLabel htmlFor="agent-name">Name *</FieldLabel>
					<Input
						id="agent-name"
						required
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="My Agent"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="agent-type">Type *</FieldLabel>
					<Input
						id="agent-type"
						required
						value={type}
						onChange={(e) => setType(e.target.value)}
						placeholder="e.g. llm, tool, router"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="agent-description">Description</FieldLabel>
					<Input
						id="agent-description"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Optional description"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="agent-config">Config (JSON)</FieldLabel>
					<Textarea
						id="agent-config"
						rows={4}
						value={configText}
						onChange={(e) => setConfigText(e.target.value)}
						className="font-mono text-xs"
					/>
				</Field>
			</FieldGroup>
			<DialogFooter>
				<Button type="submit" disabled={loading}>
					{loading ? "Creating…" : "Create Agent"}
				</Button>
			</DialogFooter>
		</form>
	)
}
