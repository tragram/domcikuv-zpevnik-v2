import {
  Outlet,
  redirect,
  createFileRoute,
  Link,
} from "@tanstack/react-router";
import { CloudUpload, Home, Shield } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const PROFILE_URL = "/profile";
const LOGIN_URL = "/login";
const SIGNUP_URL = "/signup";
const SUBMISSIONS_URL = "/submissions";

export const Route = createFileRoute("/(auth)")({
  // TODO: disable when offline
  component: RouteComponent,
  beforeLoad: async ({ context, location, search }) => {
    // Get the redirect URL from search params or default to "/"
    const redirectURL = (search as { redirect?: string })?.redirect || "/";

    // If user is not logged in and not on login/signup page, redirect to login
    if (!context.user.loggedIn && location.pathname === PROFILE_URL) {
      throw redirect({
        to: LOGIN_URL,
        search: { redirect: redirectURL },
      });
    }

    // If user is logged in and on login page, redirect to the intended destination
    if (context.user.loggedIn) {
      if (location.pathname === LOGIN_URL) {
        throw redirect({
          to: redirectURL,
        });
      }

      // If user is logged in and on signup page, redirect to the intended destination
      if (location.pathname === SIGNUP_URL) {
        throw redirect({
          to: redirectURL,
        });
      }
    }

    return { redirectURL, location };
  },
  loader: async ({ context }) => {
    return context;
  },
});

export const AuthHeader: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="flex flex-col items-center gap-4 mb-4">
      <a href="#" className="flex flex-col items-center gap-2 font-medium">
        <div className="flex h-12 w-12 items-center justify-center rounded-md">
          <img src="/icons/favicon.svg" alt="Logo" className="h-12 w-12" />
        </div>
        <span className="sr-only">Domčíkův Zpěvník</span>
      </a>
      <h1 className="text-lg md:text-xl font-bold">{text}</h1>
    </div>
  );
};

function RouteComponent() {
  const { location, user } = Route.useLoaderData();
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 w-full">
      <div className="w-fit flex flex-col gap-4 xl:gap-8">
        <div
          className={cn(
            "flex flex-wrap w-auto border-4 border-primary rounded-md max-md:justify-around md:justify-between [&>*]:bg-transparent [&>*]:rounded-none"
          )}
        >
          {/* links */}
          <div
            className={cn(
              "flex w-full profile-toolbar-links",
              user.loggedIn ? "justify-between" : ""
            )}
          >
            <Button asChild>
              <Link to="/">
                <Home />
                Home
              </Link>
            </Button>
            {user.loggedIn && (
              <Button asChild className="sm:w-auto">
                <Link to="/submissions">
                  <CloudUpload />
                  My submissions
                </Link>
              </Button>
            )}
            {user.profile?.isAdmin && (
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
