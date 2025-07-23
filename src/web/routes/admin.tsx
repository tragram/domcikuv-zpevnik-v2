import { createFileRoute, redirect } from "@tanstack/react-router";
import AdminDashboard from "~/features/AdminDashboard/AdminDashboard";
import { 
  fetchSongDBAdmin, 
  fetchIllustrationsAdmin, 
  fetchVersionsAdmin 
} from "~/services/songs";
import { fetchUsersAdmin } from "~/services/users"; // Add this import

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
    const [songDBAdmin, illustrations, versions, users] = await Promise.all([
      context.queryClient.fetchQuery({
        queryKey: ["songDBAdmin"],
        queryFn: () => fetchSongDBAdmin(context.api.admin),
        staleTime: 1000 * 60 * 60 * 24 * 7, // seven days
      }),
      context.queryClient.fetchQuery({
        queryKey: ["illustrationsAdmin"],
        queryFn: () => fetchIllustrationsAdmin(context.api.admin),
        staleTime: 1000 * 60 * 60 * 24 * 7, // seven days
      }),
      context.queryClient.fetchQuery({
        queryKey: ["versionsAdmin"],
        queryFn: () => fetchVersionsAdmin(context.api.admin),
        staleTime: 1000 * 60 * 60 * 24 * 7, // seven days
      }),
      context.queryClient.fetchQuery({
        queryKey: ["usersAdmin"],
        queryFn: () => fetchUsersAdmin(context.api.admin.users, { limit: 20, offset: 0 }),
        staleTime: 1000 * 60 * 60 * 24 * 7, // seven days
      })
    ]);
    
    return { ...context, songDBAdmin, illustrations, versions, users };
  },
  ssr: false,
});

function Home() {
  const { songDBAdmin, illustrations, versions, users } = Route.useLoaderData();
  return (
    <AdminDashboard 
      songDB={songDBAdmin} 
      illustrations={illustrations} 
      versions={versions}
      users={users}
    />
  );
}