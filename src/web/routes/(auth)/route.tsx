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
import { getUserData } from "src/web/hooks/use-user-data";

const PROFILE_URL = "/profile";
const LOGIN_URL = "/login";
const SIGNUP_URL = "/signup";
const SUBMISSIONS_URL = "/submissions";

export const Route = createFileRoute("/(auth)")({
  // TODO: disable when offline
  validateSearch: (search) => redirectSearchSchema.parse(search),
  component: RouteComponent,
  beforeLoad: async ({ context, location, search }) => {
    const userData = await getUserData();
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

    return { redirectURL, location, userData };
  },
  loader: async ({ context }) => {
    return context;
  },
});

function RouteComponent() {
  const { userData } = Route.useLoaderData();

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 w-full">
      <div className="w-fit flex flex-col gap-4 xl:gap-8">
        <div
          className={cn(
            "flex flex-wrap w-auto border-4 border-primary rounded-md max-md:justify-around md:justify-between [&>*]:bg-transparent [&>*]:rounded-none",
          )}
        >
          {/* links */}
          <div
            className={cn(
              "flex w-full profile-toolbar-links",
              userData ? "justify-between" : "",
            )}
          >
            <Button asChild>
              <Link to="/">
                <Home />
                Home
              </Link>
            </Button>
            {userData && (
              <Button asChild className="sm:w-auto">
                <Link to="/submissions">
                  <CloudUpload />
                  My submissions
                </Link>
              </Button>
            )}
            {userData && userData.profile.isAdmin && (
              <Button asChild className="sm:w-auto">
                <Link to="/admin">
                  <Shield />
                  Admin
                </Link>
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4 md:border-4 border-primary rounded-md p-2 md:p-4 lg:p-8 w-full max-w-fit">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
