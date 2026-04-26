import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { useAuth } from "@/app/auth-context"

export const Route = createFileRoute("/_authenticated")({
	component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
	const { user, loading } = useAuth()
	const navigate = useNavigate()

	useEffect(() => {
		if (!loading && !user) {
			void navigate({ to: "/login" })
		}
	}, [user, loading, navigate])

	if (loading) {
		return (
			<div className="flex h-screen items-center justify-center">
				<span className="text-muted-foreground text-sm">Loading…</span>
			</div>
		)
	}

	if (!user) return null

	return (
		<div className="flex h-screen flex-col">
			<header className="flex items-center justify-between border-b px-6 py-3">
				<span className="font-semibold">AgentFlow</span>
				<span className="text-muted-foreground text-sm">{user.email}</span>
			</header>
			<main className="flex-1 overflow-auto p-6">
				<Outlet />
			</main>
		</div>
	)
}
