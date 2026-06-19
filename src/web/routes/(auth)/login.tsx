import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { signIn } from "~/../lib/auth/client";
import { AuthHeader } from "~/components/AuthHeader";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { redirectSearchSchema } from "~/types/types";
import GithubIcon from "~/components/ui/github_icon";
import GoogleIcon from "~/components/ui/google_icon";

export const Route = createFileRoute("/(auth)/login")({
  validateSearch: (search) => redirectSearchSchema.parse(search),
  component: LoginForm,
});

function LoginForm() {
  const { redirectURL } = Route.useRouteContext();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    if (!email || !password) return;

    setIsLoading(true);
    setErrorMessage("");

    signIn.email(
      {
        email,
        password,
      },
      {
        onError: (ctx) => {
          setErrorMessage(ctx.error.message);
          setIsLoading(false);
        },
        onSuccess: async () => {
          navigate({ to: redirectURL });
        },
      },
    );
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4">
          <AuthHeader text="Domčíkův Zpěvník login" />
          <div className="flex flex-col gap-5">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="hello@example.com"
                className="!placeholder:text-muted-foreground/50"
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
                placeholder="Enter password here"
                readOnly={isLoading}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full text-lg"
              size="lg"
              disabled={isLoading}
            >
              {isLoading && <LoaderCircle className="animate-spin" />}
              {isLoading ? "Logging in..." : "Login"}
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
              disabled={import.meta.env.DEV || isLoading}
              onClick={() =>
                signIn.social(
                  {
                    provider: "github",
                    callbackURL: redirectURL,
                  },
                  {
                    onRequest: () => {
                      setIsLoading(true);
                      setErrorMessage("");
                    },
                    onSuccess: async () => {
                      navigate({ to: redirectURL });
                    },
                    onError: (ctx) => {
                      setIsLoading(false);
                      setErrorMessage(ctx.error.message);
                    },
                  },
                )
              }
            >
              <GithubIcon />
              Login with GitHub
            </Button>
            <Button
              variant="outline"
              className="w-full"
              type="button"
              disabled={isLoading}
              onClick={() =>
                signIn.social(
                  {
                    provider: "google",
                    callbackURL: redirectURL,
                  },
                  {
                    onRequest: () => {
                      setIsLoading(true);
                      setErrorMessage("");
                    },
                    onSuccess: async () => {
                      navigate({ to: redirectURL });
                    },
                    onError: (ctx) => {
                      setIsLoading(false);
                      setErrorMessage(ctx.error.message);
                    },
                  },
                )
              }
            >
              <GoogleIcon />
              Login with Google
            </Button>
          </div>
        </div>
      </form>

      <div className="text-center text-sm">
        Don't have an account?{" "}
        <Link
          to="/signup"
          search={{ redirect: redirectURL }}
          className="underline underline-offset-4"
        >
          Sign up
        </Link>
      </div>
    </>
  );
}
