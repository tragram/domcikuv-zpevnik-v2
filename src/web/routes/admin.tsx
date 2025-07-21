import { createFileRoute, redirect } from "@tanstack/react-router";
import AdminDashboard from "~/features/AdminDashboard/AdminDashboard";
import { fetchSongDBAdmin } from "~/lib/songs";
export const Route = createFileRoute("/admin")({
  component: Home,
  beforeLoad: async ({ context }) => {
    const songDBAdmin = await context.queryClient.fetchQuery({
      queryKey: ["songDBAdmin"],
      queryFn: () => fetchSongDBAdmin(context.api.admin),
      staleTime: 1000 * 60 * 60 * 24 * 7, // seven days
    });
    console.log(songDBAdmin)
    const userProfile = context.queryClient.getQueryData(["userProfile"]);
    // TODO: consider using https://github.com/lukemorales/query-key-factory to fix this TS error
    if (import.meta.env.DEV || userProfile.isAdmin) {
      return { ...context, songDBAdmin };
    } else {
      throw redirect({ to: "/" });
    }
  },
  loader: async ({ context }) => {
    return context;
  },
  ssr: false,
});

function Home() {
  const { songDBAdmin } = Route.useLoaderData();
  return <AdminDashboard songDB={songDBAdmin} />;
}
