import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/dashboard")({
	component: Dashboard,
})

function Dashboard() {
	return (
		<div>
			<h1 className="mb-4 text-2xl font-bold">Dashboard</h1>
			<p className="text-muted-foreground">
				Welcome to AgentFlow. Use the navigation to manage your agents and
				workflows.
			</p>
		</div>
	)
}
