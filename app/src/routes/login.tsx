import { createFileRoute } from "@tanstack/react-router"

import { LoginForm } from "@/components/login-form"

export const Route = createFileRoute("/login")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a
          href="#"
          className="relative z-20 mr-4 flex items-center self-center space-x-2 px-2 py-1 text-sm font-normal text-black"
        >
          <img src="/agentflow.png" alt="logo" width={30} height={30} />
          <span className="font-medium text-black dark:text-white">
            AgentFlow
          </span>
        </a>
        <LoginForm />
      </div>
    </div>
  )
}
