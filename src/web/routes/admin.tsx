import { createFileRoute, redirect } from "@tanstack/react-router";
import AdminDashboard from "~/features/AdminDashboard/AdminDashboard";
import { z } from "zod";
import { queryClient } from "src/lib/query-client";
import { userProfileQueryOptions } from "~/hooks/use-user-profile";
export const Route = createFileRoute("/admin")({
  validateSearch: z.object({
    tab: z.string().optional(),
  }),
  component: Home,
  beforeLoad: async ({ context }) => {
    const user = await queryClient.ensureQueryData(userProfileQueryOptions());
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
