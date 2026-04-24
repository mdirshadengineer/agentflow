import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: RootComponent,
})

function RootComponent() {
  return <div>hello world</div>
}
