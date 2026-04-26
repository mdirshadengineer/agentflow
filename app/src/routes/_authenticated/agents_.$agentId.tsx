import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

export const Route = createFileRoute("/_authenticated/agents/$agentId")({
	component: AgentDetailPage,
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

function AgentDetailPage() {
	const { agentId } = Route.useParams()
	const navigate = useNavigate()
	const [agent, setAgent] = useState<Agent | null>(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Form state
	const [name, setName] = useState("")
	const [type, setType] = useState("")
	const [description, setDescription] = useState("")
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
				setConfigText(JSON.stringify(a.config, null, 2))
			})
			.catch(() => toast.error("Failed to load agent"))
			.finally(() => setLoading(false))
	}, [agentId])

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
		if (!confirm(`Delete agent "${agent?.name}"? This cannot be undone.`))
			return
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
				<Card>
					<CardHeader className="border-b pb-3">
						<CardTitle className="text-sm">Agent Details</CardTitle>
					</CardHeader>
					<CardContent className="pt-4">
						<form onSubmit={handleSave}>
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
			)}
		</div>
	)
}
