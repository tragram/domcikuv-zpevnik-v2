import { createFileRoute, redirect } from "@tanstack/react-router";
import AdminDashboard from "~/features/AdminDashboard/AdminDashboard";
import { 
  fetchSongDBAdmin, 
  fetchIllustrationsAdmin, 
  fetchChangesAdmin 
} from "~/lib/songs";
import { fetchUsersAdmin } from "~/lib/user"; // Add this import

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
    const [songDBAdmin, illustrations, changes, users] = await Promise.all([
      context.queryClient.fetchQuery({
        queryKey: ["songDBAdmin"],
        queryFn: () => fetchSongDBAdmin(context.api.admin),
        staleTime: 1000 * 60 * 60 * 24 * 7, // seven days
      }),
      context.queryClient.fetchQuery({
        queryKey: ["illustrationsAdmin"],
        queryFn: () => fetchIllustrationsAdmin(context.api.admin),
        staleTime: 1000 * 60 * 5, // five minutes
      }),
      context.queryClient.fetchQuery({
        queryKey: ["changesAdmin"],
        queryFn: () => fetchChangesAdmin(context.api.admin),
        staleTime: 1000 * 60 * 5, // five minutes
      }),
      // Add users data fetching
      context.queryClient.fetchQuery({
        queryKey: ["usersAdmin"],
        queryFn: () => fetchUsersAdmin(context.api.admin.users, { limit: 20, offset: 0 }),
        staleTime: 1000 * 60 * 2, // two minutes
      })
    ]);
    
    return { ...context, songDBAdmin, illustrations, changes, users };
  },
  ssr: false,
});

function Home() {
  const { songDBAdmin, illustrations, changes, users } = Route.useLoaderData();
  return (
    <AdminDashboard 
      songDB={songDBAdmin} 
      illustrations={illustrations} 
      changes={changes}
      users={users}
    />
  );
}