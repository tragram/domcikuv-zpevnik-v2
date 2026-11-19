import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import client from "src/worker/api-client";
import { makeApiRequest } from "~/services/api-service";
import { favoritesQueryOptions } from "./use-user-data";

export function useSaveSongbookVersion(songId: string, userId?: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();

  return useMutation({
    mutationFn: (versionId: string) => makeApiRequest(() =>
      client.api.favorites[":songId"].$patch({
        param: { songId },
        json: { pinnedVersionId: versionId },
      }),
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: favoritesQueryOptions(userId).queryKey,
        refetchType: "all",
      });
      await navigate({ to: "/song/$songId", params: { songId }, search: {} });
      await router.invalidate();
      toast.success("Version saved to your songbook");
    },
    onError: () => toast.error("Couldn't save your version preference. Please try again."),
  });
}
