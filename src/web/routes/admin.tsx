import { createFileRoute, redirect } from "@tanstack/react-router";
import { getUserData } from "src/web/hooks/use-user-data";
import { z } from "zod";
import AdminDashboard from "~/features/AdminDashboard/AdminDashboard";
import { OfflineNotice } from "~/components/OfflineIndicator";
import { useIsOnline } from "~/hooks/use-is-online";
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
  const isOnline = useIsOnline();

  // Every admin action is a live server call; an offline dashboard is just a wall
  // of failed queries. Show a clear notice instead.
  if (!isOnline) {
    return (
      <OfflineNotice
        title="Admin is offline"
        description="The admin dashboard needs an internet connection. Reconnect to manage songs, illustrations, and users."
      />
    );
  }

  return <AdminDashboard adminApi={api.admin} />;
}
