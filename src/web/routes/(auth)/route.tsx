import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { CloudUpload, Home, Shield } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { redirectSearchSchema } from "~/types/types";
import { refreshUserData } from "src/web/hooks/use-user-data";

const PROFILE_URL = "/profile";
const LOGIN_URL = "/login";
const SIGNUP_URL = "/signup";

export const Route = createFileRoute("/(auth)")({
  validateSearch: (search) => redirectSearchSchema.parse(search),
  component: RouteComponent,
  beforeLoad: async ({ location, search }) => {
    // Revalidated, not read from the persisted cache: a stale "logged-in"
    // (expired cookie) must not redirect the user away from /login, and a
    // stale "logged-out" (just-completed OAuth) must not bounce them off
    // /profile. Offline it degrades to the cached session.
    const userData = await refreshUserData();
    // Get the redirect URL from validated search params or default to "/"
    const redirectURL = search.redirect || "/";

    // If user is not logged in and not on login/signup page, redirect to login
    if (!userData && location.pathname === PROFILE_URL) {
      throw redirect({
        to: LOGIN_URL,
        search: { redirect: redirectURL },
      });
    }

    // If user is logged in and on login page, redirect to the intended destination
    if (userData) {
      if (location.pathname === LOGIN_URL) {
        throw redirect({
          href: redirectURL,
        });
      }

      // If user is logged in and on signup page, redirect to the intended destination
      if (location.pathname === SIGNUP_URL) {
        throw redirect({
          href: redirectURL,
        });
      }
    }

    return { redirectURL, userData };
  },
  loader: async ({ context }) => {
    return { userData: context.userData };
  },
});

function RouteComponent() {
  const { userData } = Route.useLoaderData();

  return (
    <div
      className={cn(
        "bg-background flex min-h-svh flex-col items-center gap-6 p-3 sm:p-6 md:p-10 w-full",
        // Center the login/signup card; content pages (profile, submissions)
        // read better anchored to the top.
        userData ? "justify-start" : "justify-center",
      )}
    >
      <div className="w-full sm:w-fit flex flex-col gap-4 xl:gap-8">
        <nav
          aria-label="Site navigation"
          className={cn(
            "flex w-full flex-wrap rounded-md border-4 border-primary profile-toolbar-links",
            userData && "justify-between",
          )}
        >
          <Button variant="toolbar" asChild>
            <Link to="/">
              <Home />
              Home
            </Link>
          </Button>
          {userData && (
            <Button variant="toolbar" asChild>
              <Link to="/submissions">
                <CloudUpload />
                Submissions
              </Link>
            </Button>
          )}
          {userData && userData.profile.isAdmin && (
            <Button variant="toolbar" asChild>
              <Link to="/admin">
                <Shield />
                Admin
              </Link>
            </Button>
          )}
        </nav>
        <div className="flex flex-col gap-4 md:border-4 border-primary rounded-md p-2 md:p-4 lg:p-8 w-full max-w-full sm:max-w-fit">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
