import { createFileRoute, redirect } from "@tanstack/react-router";
import AdminDashboard from "~/features/AdminDashboard/AdminDashboard";
import { z } from "zod";
export const Route = createFileRoute("/admin")({
  validateSearch: z.object({
    tab: z.string().optional(),
  }),
  component: Home,
  beforeLoad: async ({ context }) => {
    const user = context.user;
    if (user.loggedIn && user.profile.isAdmin) {
      return context;
    } else {
      throw redirect({ to: "/" });
    }
  },
  loader: ({ context }) => context,
  ssr: false,
});

function Home() {
  const { api } = Route.useRouteContext();

  return <AdminDashboard adminApi={api.admin} />;
}
