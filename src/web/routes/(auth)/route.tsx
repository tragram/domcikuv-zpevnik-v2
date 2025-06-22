import { Outlet, redirect, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)")({
  // TODO: disable when offline
  component: RouteComponent,
  beforeLoad: async ({ context, location }) => {
    const PROFILE_URL = "/profile";
    const LOGIN_URL = "/login";
    const SIGNUP_URL = "/signup";
    // If user is not logged in and not on login page, redirect to login
    if (!context.userData.loggedIn && location.pathname === PROFILE_URL) {
      throw redirect({
        to: LOGIN_URL,
      });
    }

    // If user is logged in and on login page, redirect to profile
    if (context.userData.loggedIn && location.pathname === LOGIN_URL) {
      throw redirect({
        to: PROFILE_URL,
      });
    }
    return { redirectURL: "/" };
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
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col gap-4 md:border-4 border-primary rounded-md p-8 md:p-16">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
