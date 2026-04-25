import {
	createRouter,
	ErrorComponent,
	RouterProvider,
} from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { Swirling } from "@/components/loading-ui/swirling"
import { routeTree } from "@/routeTree.gen"
import { ShadcnProviders } from "./shadcn-providers"

const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	// Since we're using React Query, we don't want loader calls to ever be stale
	// This will ensure that the loader is always called when the route is preloaded or visited
	defaultPreloadStaleTime: 0,
	scrollRestoration: true,
	defaultStaleTime: 5000,
	defaultErrorComponent: ({ error }) => <ErrorComponent error={error} />,
	defaultPendingComponent: () => <Swirling />,
})

// Register things for typesafety
declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router
	}
}

export function App() {
	return (
		<ShadcnProviders>
			<RouterProvider router={router} />
			{!import.meta.env.PROD && <TanStackRouterDevtools router={router} />}
		</ShadcnProviders>
	)
}
