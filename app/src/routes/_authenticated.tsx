import {
	createFileRoute,
	Link,
	Outlet,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router"
import {
	BotIcon,
	LayoutDashboardIcon,
	LogOutIcon,
	WorkflowIcon,
} from "lucide-react"
import { useEffect } from "react"
import { useAuth } from "@/app/auth-context"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar"

export const Route = createFileRoute("/_authenticated")({
	component: AuthenticatedLayout,
})

const NAV_ITEMS = [
	{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
	{ to: "/agents", label: "Agents", icon: BotIcon },
	{ to: "/workflows", label: "Workflows", icon: WorkflowIcon },
] as const

function AppSidebar() {
	const { location } = useRouterState()

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<Link to="/dashboard">
								<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
									AF
								</div>
								<span className="font-semibold">AgentFlow</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarMenu>
						{NAV_ITEMS.map(({ to, label, icon: Icon }) => (
							<SidebarMenuItem key={to}>
								<SidebarMenuButton
									asChild
									isActive={
										location.pathname === to ||
										(to !== "/dashboard" && location.pathname.startsWith(to))
									}
									tooltip={label}
								>
									<Link to={to}>
										<Icon />
										<span>{label}</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter />
		</Sidebar>
	)
}

function AuthenticatedLayout() {
	const { user, loading, logout } = useAuth()
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

	const handleLogout = async () => {
		await logout()
		void navigate({ to: "/login" })
	}

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator orientation="vertical" className="mr-2 h-4" />
					<div className="ml-auto flex items-center gap-2">
						<span className="text-muted-foreground text-xs">{user.email}</span>
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={handleLogout}
							title="Log out"
						>
							<LogOutIcon />
							<span className="sr-only">Log out</span>
						</Button>
					</div>
				</header>
				<main className="flex-1 overflow-auto p-6">
					<Outlet />
				</main>
			</SidebarInset>
		</SidebarProvider>
	)
}
