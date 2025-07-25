import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import AdminDashboard from "~/features/AdminDashboard/AdminDashboard";
import {
  fetchSongDBAdmin,
  fetchIllustrationsAdmin,
  fetchVersionsAdmin,
  fetchPromptsAdmin,
} from "~/services/songs";
import { fetchUsersAdmin } from "~/services/users";

export const Route = createFileRoute("/admin")({
  component: Home,
  beforeLoad: async ({ context }) => {
    const userProfile = context.queryClient.getQueryData(["userProfile"]);
    if (!(userProfile?.isAdmin)) {
      throw redirect({ to: "/" });
    }
    return context;
  },
  loader: ({ context }) => context,
  // Remove loader entirely for mutable data
  ssr: false,
});

function Home() {
  const { api } = Route.useRouteContext();

  // Use query hooks instead of loader data
  const { data: songDBAdmin } = useQuery({
    queryKey: ["songDBAdmin"],
    queryFn: () => fetchSongDBAdmin(api.admin),
    staleTime: 1000 * 60 * 60 * 24 * 7, // Keep long stale time for TanStack Query
  });

  const { data: illustrations } = useQuery({
    queryKey: ["illustrationsAdmin"],
    queryFn: () => fetchIllustrationsAdmin(api.admin),
    staleTime: 1000 * 60 * 60 * 24 * 7,
  });
  const { data: prompts } = useQuery({
    queryKey: ["promptsAdmin"],
    queryFn: () => fetchPromptsAdmin(api.admin),
    staleTime: 1000 * 60 * 60 * 24 * 7,
  });

  const { data: versions } = useQuery({
    queryKey: ["versionsAdmin"],
    queryFn: () => fetchVersionsAdmin(api.admin),
    staleTime: 1000 * 60 * 60 * 24 * 7,
  });

  const { data: users } = useQuery({
    queryKey: ["usersAdmin"],
    queryFn: () => fetchUsersAdmin(api.admin.users, { limit: 20, offset: 0 }),
    staleTime: 1000 * 60 * 60 * 24 * 7,
  });

  // Show loading state while any query is loading
  if (!songDBAdmin || !illustrations || !versions || !users) {
    return <div>Loading...</div>;
  }
  
  return (
    <AdminDashboard
      songDB={songDBAdmin}
      illustrations={illustrations}
      prompts={prompts}
      versions={versions}
      users={users}
    />
  );
}
