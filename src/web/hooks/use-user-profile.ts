import { queryOptions, useQuery } from "@tanstack/react-query";
import { queryClient } from "src/lib/query-client";
import client from "src/worker/api-client";
import { UserProfileData } from "src/worker/api/userProfile";
import { fetchProfile } from "~/services/user-service";

export const userProfileQueryOptions = () =>
  queryOptions({
    queryKey: ["userProfile"],
    queryFn: () => fetchProfile(client.api),
    // TODO: or placeholderData?
    initialData: { loggedIn: false } as UserProfileData,
  });

export const loadUserProfile = async () =>
  queryClient.fetchQuery(userProfileQueryOptions());

export function useUserProfile() {
  const { data: userProfile, isFetching: isUserProfileSyncing } = useQuery(
    userProfileQueryOptions(),
  );

  return {
    userProfile: userProfile as UserProfileData,
    isSyncing: isUserProfileSyncing,
  };
}

export async function useLoggedIn() {
  const userProfile = await loadUserProfile();
  return userProfile.loggedIn;
}
