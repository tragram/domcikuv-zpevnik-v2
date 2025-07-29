import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import AdminDashboard from "~/features/AdminDashboard/AdminDashboard";
import {
  fetchSongDBAdmin,
  fetchIllustrationsAdmin,
  fetchVersionsAdmin,
  fetchPromptsAdmin,
  getSongsAdmin,
} from "~/services/songs";
import { fetchUsersAdmin } from "~/services/users";

export const Route = createFileRoute("/admin")({
  component: Home,
  beforeLoad: async ({ context }) => {
    const user = context.queryClient.getQueryData(["userProfile"]);
    if (!user?.profile.isAdmin) {
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
  const { data: songs } = useQuery({
    queryKey: ["songsAdmin"],
    queryFn: () => getSongsAdmin(api.admin),
    staleTime: 1000 * 60 * 60, // minute
  });

  const { data: illustrations } = useQuery({
    queryKey: ["illustrationsAdmin"],
    queryFn: () => fetchIllustrationsAdmin(api.admin),
    staleTime: 1000 * 60 * 60,
  });
  const { data: prompts } = useQuery({
    queryKey: ["promptsAdmin"],
    queryFn: () => fetchPromptsAdmin(api.admin),
    staleTime: 1000 * 60 * 60,
  });

  const { data: versions } = useQuery({
    queryKey: ["versionsAdmin"],
    queryFn: () => fetchVersionsAdmin(api.admin),
    staleTime: 1000 * 60 * 60,
  });

  const { data: users } = useQuery({
    queryKey: ["usersAdmin"],
    queryFn: () => fetchUsersAdmin(api.admin.users, { limit: 20, offset: 0 }),
    staleTime: 1000 * 60 * 60,
  });

  // Show loading state while any query is loading
  if (!songs || !illustrations || !versions || !users || !prompts) {
    return <div>Loading...</div>;
  }

  return (
    <AdminDashboard
      songs={songs}
      illustrations={illustrations}
      prompts={prompts}
      versions={versions}
      users={users}
    />
  );
}
