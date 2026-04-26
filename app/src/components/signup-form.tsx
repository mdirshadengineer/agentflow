import { Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useAuth } from "@/app/auth-context"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function SignupForm({
	className,
	...props
}: React.ComponentProps<"div">) {
	const { register } = useAuth()
	const navigate = useNavigate()
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)
		if (password.length < 8) {
			setError("Password must be at least 8 characters")
			return
		}
		setLoading(true)
		try {
			await register(email, password)
			await navigate({ to: "/dashboard" })
		} catch (err) {
			setError(err instanceof Error ? err.message : "Registration failed")
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader className="text-center">
					<CardTitle className="text-xl">Create your account</CardTitle>
					<CardDescription>
						Enter your email below to create your account
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							{error && (
								<p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
									{error}
								</p>
							)}
							<Field>
								<FieldLabel htmlFor="email">Email</FieldLabel>
								<Input
									id="email"
									type="email"
									placeholder="m@example.com"
									required
									value={email}
									onChange={(e) => setEmail(e.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="password">Password</FieldLabel>
								<Input
									id="password"
									type="password"
									required
									value={password}
									onChange={(e) => setPassword(e.target.value)}
								/>
								<FieldDescription>
									Must be at least 8 characters long.
								</FieldDescription>
							</Field>
							<Field>
								<Button type="submit" disabled={loading}>
									{loading ? "Creating account…" : "Create Account"}
								</Button>
								<FieldDescription className="text-center">
									Already have an account? <Link to="/login">Sign in</Link>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	)
}
