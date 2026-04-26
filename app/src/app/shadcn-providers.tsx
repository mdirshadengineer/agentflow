import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from "./auth-context"

function ShadcnProviders({ children }: { children: React.ReactNode }) {
	return (
		<AuthProvider>
			<ThemeProvider defaultTheme="system">
				<TooltipProvider>
					<Toaster richColors />
					{children}
				</TooltipProvider>
			</ThemeProvider>
		</AuthProvider>
	)
}

export { ShadcnProviders }
