import { createFileRoute, redirect } from "@tanstack/react-router";
import AdminDashboard from "~/features/AdminDashboard/AdminDashboard";
import { fetchSongDBAdmin, fetchIllustrationsAdmin } from "~/lib/songs";

export const Route = createFileRoute("/admin")({
  component: Home,
  beforeLoad: async ({ context }) => {
    const userProfile = context.queryClient.getQueryData(["userProfile"]);
    // TODO: consider using https://github.com/lukemorales/query-key-factory to fix this TS error
    if (!(import.meta.env.DEV || userProfile?.isAdmin)) {
      throw redirect({ to: "/" });
    }
    return context;
  },
  loader: async ({ context }) => {
    const [songDBAdmin, illustrations] = await Promise.all([
      context.queryClient.fetchQuery({
        queryKey: ["songDBAdmin"],
        queryFn: () => fetchSongDBAdmin(context.api.admin),
        staleTime: 1000 * 60 * 60 * 24 * 7, // seven days
      }),
      context.queryClient.fetchQuery({
        queryKey: ["illustrationsAdmin"],
        queryFn: () => fetchIllustrationsAdmin(context.api.admin),
        staleTime: 1000 * 60 * 5, // five minutes
      })
    ]);
    
    return { ...context, songDBAdmin, illustrations };
  },
  ssr: false,
});

function Home() {
  const { songDBAdmin, illustrations } = Route.useLoaderData();
  return <AdminDashboard songDB={songDBAdmin} illustrations={illustrations} />;
}