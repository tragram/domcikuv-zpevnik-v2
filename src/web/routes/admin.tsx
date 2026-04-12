import { createFileRoute, redirect } from "@tanstack/react-router";
import { getUserData } from "src/web/hooks/use-user-data";
import { z } from "zod";
import AdminDashboard from "~/features/AdminDashboard/AdminDashboard";
export const Route = createFileRoute("/admin")({
  validateSearch: z.object({
    tab: z.string().optional(),
  }),
  component: Home,
  beforeLoad: async ({ context }) => {
    const userData = await getUserData();
    if (userData && userData.profile.isAdmin) {
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
