import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { signIn, signUp } from "~/../lib/auth/client";
import { refreshUserData } from "~/hooks/use-user-data";
import { AuthHeader } from "~/components/AuthHeader";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { redirectSearchSchema } from "~/types/types";
import GithubIcon from "~/components/ui/github_icon";
import GoogleIcon from "~/components/ui/google_icon";
import { OfflineInlineNote } from "~/components/OfflineIndicator";
import { useIsOnline } from "~/hooks/use-is-online";

export const Route = createFileRoute("/(auth)/signup")({
  validateSearch: (search) => redirectSearchSchema.parse(search),
  component: SignupForm,
});

function SignupForm() {
  const { redirectURL } = Route.useRouteContext();
  const navigate = useNavigate();
  const isOnline = useIsOnline();

  const safeRedirectURL = typeof redirectURL === "string" ? redirectURL : "/";

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirm_password") as string;

    if (!name || !email || !password || !confirmPassword) return;

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    const { error } = await signUp.email({
      name,
      email,
      password,
      callbackURL: safeRedirectURL,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
    } else {
      // Fetch the user's data (session, favorites, submissions) before
      // redirecting, so the destination renders complete instead of
      // hearts/toolbar icons popping in after arrival.
      await refreshUserData();
      navigate({ to: safeRedirectURL });
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4">
          <AuthHeader text="Sign up for Domčíkův Zpěvník!" />
          <OfflineInlineNote message="You're offline — connect to the internet to sign up." />
          <div className="flex flex-col gap-5">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                readOnly={isLoading}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="hello@example.com"
                readOnly={isLoading}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Password"
                readOnly={isLoading}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <Input
                id="confirm_password"
                name="confirm_password"
                type="password"
                placeholder="Confirm Password"
                readOnly={isLoading}
                required
              />
            </div>
            <Button
              type="submit"
              className="mt-2 w-full"
              size="lg"
              disabled={isLoading || !isOnline}
            >
              {isLoading && <LoaderCircle className="animate-spin mr-2" />}
              {isLoading ? "Signing up..." : "Sign up"}
            </Button>
          </div>
          {errorMessage && (
            <span className="text-destructive text-center text-sm">
              {errorMessage}
            </span>
          )}

          <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
            <span className="bg-background text-muted-foreground relative z-10 px-2">
              Or
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Button
              variant="outline"
              className="w-full"
              type="button"
              disabled={isLoading || !isOnline}
              onClick={async () => {
                setIsLoading(true);
                setErrorMessage("");
                const { error } = await signIn.social({
                  provider: "github",
                  callbackURL: safeRedirectURL,
                });
                if (error) {
                  setIsLoading(false);
                  setErrorMessage(error.message);
                }
              }}
            >
              <GithubIcon />
              Sign up with GitHub
            </Button>
            <Button
              variant="outline"
              className="w-full"
              type="button"
              disabled={isLoading || !isOnline}
              onClick={async () => {
                setIsLoading(true);
                setErrorMessage("");
                const { error } = await signIn.social({
                  provider: "google",
                  callbackURL: safeRedirectURL,
                });
                if (error) {
                  setIsLoading(false);
                  setErrorMessage(error.message);
                }
              }}
            >
              <GoogleIcon />
              Sign up with Google
            </Button>
          </div>
        </div>
      </form>

      <div className="text-center text-sm">
        Already have an account?{" "}
        <Link
          to="/login"
          search={{ redirect: redirectURL }}
          className="underline underline-offset-4"
        >
          Login
        </Link>
      </div>
    </>
  );
}
