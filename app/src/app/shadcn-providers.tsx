import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

function ShadcnProviders({ children }: { children: React.ReactNode }) {
	return (
		<ThemeProvider defaultTheme="system">
			<TooltipProvider>
				<Toaster richColors />
				{children}
			</TooltipProvider>
		</ThemeProvider>
	)
}

export { ShadcnProviders }
