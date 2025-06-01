
import type React from "react"

import { useState } from "react"
import { Button } from "@/components/custom-ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { useLocation } from "wouter"
import { useAuth } from "@/components/contexts/AuthContext"

export default function AuthComponent() {
    const [location, setLocation] = useLocation();
    const [isLoading, setIsLoading] = useState(false)
    const { login } = useAuth();

    // Login form state
    const [loginData, setLoginData] = useState({
        email: "d@x.com",
        password: "d@x.com",
        remember: false,
    })

    // Register form state
    const [registerData, setRegisterData] = useState({
        firstName: "Dominik",
        lastName: "Hodan",
        email: "d@x.com",
        password: "d@x.com",
        confirmPassword: "d@x.com",
        terms: true,
    })

    // Handle login form input changes
    const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target
        setLoginData({
            ...loginData,
            [name]: type === "checkbox" ? checked : value,
        })
    }

    // Handle register form input changes
    const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target
        setRegisterData({
            ...registerData,
            [name]: type === "checkbox" ? checked : value,
        })
    }

    // Handle login form submission
    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const success = await login(loginData.email, loginData.password);
            
            if (success) {
                toast.success("You have been logged in successfully.")
                // setLocation("/")
            }
        } catch (error) {
            toast.error("Failed to login. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    // Handle register form submission
    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Basic validation
        if (registerData.password !== registerData.confirmPassword) {
            toast.error("Passwords do not match.")
            return
        }

        setIsLoading(true)

        try {
            const response = await fetch("/api/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: registerData.firstName + " " + registerData.lastName,
                    email: registerData.email,
                    password: registerData.password,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Registration failed")
            }

            toast.success("Your account has been created successfully. Please log in.")

            // Switch to login tab
            document.querySelector('[data-value="login"]')?.click()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to register. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background/70 p-4">
            <Card className="w-full max-w-md">
                <Tabs defaultValue="login" className="w-full">
                    <CardHeader className="space-y-1">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="login">Login</TabsTrigger>
                            <TabsTrigger value="register">Register</TabsTrigger>
                        </TabsList>
                    </CardHeader>

                    <TabsContent value="login" className="gap-2">
                        <CardHeader className="space-y-1 pt-4 pb-8">
                            <CardTitle className="text-2xl text-center">Welcome back</CardTitle>
                            <CardDescription className="text-center">Enter your credentials to access your account</CardDescription>
                        </CardHeader>
                        <form onSubmit={handleLoginSubmit}>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="login-email">Email</Label>
                                    <Input
                                        id="login-email"
                                        name="email"
                                        type="email"
                                        placeholder="m@example.com"
                                        value={loginData.email}
                                        onChange={handleLoginChange}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="login-password">Password</Label>
                                    <Input
                                        id="login-password"
                                        name="password"
                                        type="password"
                                        value={loginData.password}
                                        onChange={handleLoginChange}
                                        required
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            id="remember"
                                            name="remember"
                                            checked={loginData.remember}
                                            onChange={handleLoginChange}
                                            className="h-4 w-4 rounded border-gray-300"
                                        />
                                        <Label htmlFor="remember" className="text-sm">
                                            Remember me
                                        </Label>
                                    </div>
                                    <Button variant="link" className="px-0 text-sm" type="button">
                                        Forgot password?
                                    </Button>
                                </div>
                            </CardContent>
                            <CardFooter className="flex flex-col space-y-4">
                                <Button className="w-full" type="submit" disabled={isLoading}>
                                    {isLoading ? "Signing in..." : "Sign In"}
                                </Button>
                                {/* <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <Separator className="w-full" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-white px-2 text-muted-foreground">Or continue with</span>
                                    </div>
                                </div>
                                <Button variant="outline" className="w-full" type="button">
                                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                                        <path
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            fill="#4285F4"
                                        />
                                        <path
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            fill="#34A853"
                                        />
                                        <path
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                            fill="#FBBC05"
                                        />
                                        <path
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                            fill="#EA4335"
                                        />
                                    </svg>
                                    Continue with Google
                                </Button> */}
                            </CardFooter>
                        </form>
                    </TabsContent>

                    <TabsContent value="register">
                        <CardHeader className="space-y-1  pt-4 pb-8">
                            <CardTitle className="text-2xl text-center">Create account</CardTitle>
                            <CardDescription className="text-center">Enter your information to create a new account</CardDescription>
                        </CardHeader>
                        <form onSubmit={handleRegisterSubmit}>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="first-name">First name</Label>
                                        <Input
                                            id="first-name"
                                            name="firstName"
                                            placeholder="John"
                                            value={registerData.firstName}
                                            onChange={handleRegisterChange}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="last-name">Last name</Label>
                                        <Input
                                            id="last-name"
                                            name="lastName"
                                            placeholder="Doe"
                                            value={registerData.lastName}
                                            onChange={handleRegisterChange}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="register-email">Email</Label>
                                    <Input
                                        id="register-email"
                                        name="email"
                                        type="email"
                                        placeholder="m@example.com"
                                        value={registerData.email}
                                        onChange={handleRegisterChange}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="register-password">Password</Label>
                                    <Input
                                        id="register-password"
                                        name="password"
                                        type="password"
                                        value={registerData.password}
                                        onChange={handleRegisterChange}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirm-password">Confirm password</Label>
                                    <Input
                                        id="confirm-password"
                                        name="confirmPassword"
                                        type="password"
                                        value={registerData.confirmPassword}
                                        onChange={handleRegisterChange}
                                        required
                                    />
                                </div>
                                {/* <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="terms"
                                        name="terms"
                                        checked={registerData.terms}
                                        onChange={handleRegisterChange}
                                        className="h-4 w-4 rounded border-gray-300"
                                        required
                                    />
                                    <Label htmlFor="terms" className="text-sm">
                                        I agree to the{" "}
                                        <Button variant="link" className="px-0 text-sm h-auto" type="button">
                                            Terms of Service
                                        </Button>{" "}
                                        and{" "}
                                        <Button variant="link" className="px-0 text-sm h-auto" type="button">
                                            Privacy Policy
                                        </Button>
                                    </Label>
                                </div> */}
                            </CardContent>
                            <CardFooter className="flex flex-col mt-4 space-y-4">
                                <Button className="w-full" type="submit" disabled={isLoading}>
                                    {isLoading ? "Creating Account..." : "Create Account"}
                                </Button>
                                {/* <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <Separator className="w-full" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-white px-2 text-muted-foreground">Or continue with</span>
                                    </div>
                                </div>
                                <Button variant="outline" className="w-full" type="button">
                                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                                        <path
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            fill="#4285F4"
                                        />
                                        <path
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            fill="#34A853"
                                        />
                                        <path
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                            fill="#FBBC05"
                                        />
                                        <path
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                            fill="#EA4335"
                                        />
                                    </svg>
                                    Sign up with Google
                                </Button> */}
                            </CardFooter>
                        </form>
                    </TabsContent>
                </Tabs>
            </Card>
        </div>
    )
}
