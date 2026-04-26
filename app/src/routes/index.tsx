import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import {
	MobileNav,
	MobileNavHeader,
	MobileNavMenu,
	MobileNavToggle,
	NavBody,
	Navbar,
	NavbarButton,
	NavbarLogo,
	NavItems,
} from "@/components/ui/resizable-navbar"
import { Spotlight } from "@/components/ui/spotlight"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/")({
	component: RootComponent,
})

function RootComponent() {
	const navItems = [
		{
			name: "Features",
			link: "#features",
		},
		{
			name: "Pricing",
			link: "#pricing",
		},
		{
			name: "Contact",
			link: "#contact",
		},
	]

	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

	return (
		<div className="relative w-full">
			<Navbar>
				{/* Desktop Navigation */}
				<NavBody>
					<NavbarLogo />
					<NavItems items={navItems} />
					<div className="flex items-center gap-4">
						<Link to="/login">
							<NavbarButton variant="secondary">Login</NavbarButton>
						</Link>
						<Link to="/workflows">
							<NavbarButton variant="primary">Get Started</NavbarButton>
						</Link>
					</div>
				</NavBody>

				{/* Mobile Navigation */}
				<MobileNav>
					<MobileNavHeader>
						<NavbarLogo />
						<MobileNavToggle
							isOpen={isMobileMenuOpen}
							onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
						/>
					</MobileNavHeader>

					<MobileNavMenu
						isOpen={isMobileMenuOpen}
						onClose={() => setIsMobileMenuOpen(false)}
					>
						{navItems.map((item, idx) => (
							<a
								key={`mobile-link-${idx}`}
								href={item.link}
								onClick={() => setIsMobileMenuOpen(false)}
								className="relative text-neutral-600 dark:text-neutral-300"
							>
								<span className="block">{item.name}</span>
							</a>
						))}
						<div className="flex w-full flex-col gap-4">
							<NavbarButton
								onClick={() => setIsMobileMenuOpen(false)}
								variant="primary"
								className="w-full"
							>
								Login
							</NavbarButton>
							<NavbarButton
								onClick={() => setIsMobileMenuOpen(false)}
								variant="primary"
								className="w-full"
							>
								Book a call
							</NavbarButton>
						</div>
					</MobileNavMenu>
				</MobileNav>
			</Navbar>
			<div className="relative flex h-screen w-full overflow-hidden rounded-md bg-black/96 antialiased md:items-center md:justify-center">
				<div
					className={cn(
						"pointer-events-none absolute inset-0 bg-size-[40px_40px] select-none",
						"bg-[linear-gradient(to_right,#171717_1px,transparent_1px),linear-gradient(to_bottom,#171717_1px,transparent_1px)]"
					)}
				/>

				<Spotlight
					className="-top-40 left-0 md:-top-20 md:left-60"
					fill="white"
				/>
				<div className="relative z-10 mx-auto w-full max-w-7xl p-4 pt-20 md:pt-0">
					<h1 className="bg-opacity-50 bg-linear-to-b from-neutral-50 to-neutral-400 bg-clip-text text-center text-4xl font-bold text-transparent md:text-7xl">
						AgentFlow <br /> Automate. Innovate. Collaborate.
					</h1>
					<div className="relative z-20 flex flex-wrap items-center justify-center gap-4 pt-4">
						<Link
							to="/workflows"
							className="rounded-md bg-sky-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-700 focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-black focus:outline-none"
						>
							Build a Workflow
						</Link>
						<Link
							to="/login"
							className="rounded-md border border-white/20 bg-white/10 px-6 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black focus:outline-none"
						>
							Sign In
						</Link>
					</div>
				</div>
			</div>
		</div>
	)
}
