// hooks.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AdminApi,
  createIllustration,
  deleteIllustration,
  restoreIllustration,
  deleteSongAdmin,
  deleteVersionAdmin,
  fetchIllustrationsAdmin,
  fetchPromptsAdmin,
  generateIllustration,
  getSongsAdmin,
  getVersionsAdmin,
  putSongAdmin,
  putVersionAdmin,
  resetVersionDB,
  setActiveIllustration,
  setCurrentVersionAdmin,
  songsWithCurrentVersionAdmin,
  updateIllustration,
} from "~/services/songs";
import { fetchUsersAdmin } from "~/services/users";
import {
  IllustrationPromptDB,
  SongIllustrationDB,
  SongVersionDB,
} from "src/lib/db/schema";
import { SongModificationSchema } from "src/worker/api/admin/songs";
import {
  IllustrationCreateSchema,
  IllustrationGenerateSchema,
  IllustrationModifySchema,
} from "src/worker/services/illustration-service";
import { SongWithCurrentVersion } from "src/worker/services/song-service";

export const useSongsAdmin = (adminApi: AdminApi) =>
  useQuery({
    queryKey: ["songsAdmin"],
    queryFn: () => getSongsAdmin(adminApi),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

export const useSongDBAdmin = (adminApi: AdminApi) =>
  useQuery({
    queryKey: ["songDBAdmin"],
    queryFn: () => songsWithCurrentVersionAdmin(adminApi),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

export const useIllustrationsAdmin = (adminApi: AdminApi) =>
  useQuery({
    queryKey: ["illustrationsAdmin"],
    queryFn: () => fetchIllustrationsAdmin(adminApi),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

export const usePromptsAdmin = (adminApi: AdminApi) =>
  useQuery({
    queryKey: ["promptsAdmin"],
    queryFn: () => fetchPromptsAdmin(adminApi),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

export const useVersionsAdmin = (adminApi: AdminApi) =>
  useQuery({
    queryKey: ["versionsAdmin"],
    queryFn: () => getVersionsAdmin(adminApi),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

export const useUsersAdmin = (
  adminApi: AdminApi,
  { limit, offset }: { limit: number; offset: number }
) =>
  useQuery({
    queryKey: ["usersAdmin", limit, offset],
    queryFn: () => fetchUsersAdmin(adminApi.users, { limit, offset }),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

export const useUpdateSong = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      songId,
      song,
    }: {
      songId: string;
      song: SongModificationSchema;
    }) => putSongAdmin(adminApi, songId, song),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
    },
  });
};

export const useDeleteSong = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (songId: string) => deleteSongAdmin(adminApi, songId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
    },
  });
};

export const useUpdateVersion = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      songId,
      versionId,
      version,
    }: {
      songId: string;
      versionId: string;
      version: SongVersionDB;
    }) => putVersionAdmin(adminApi, songId, versionId, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["versionsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
    },
  });
};

export const useDeleteVersion = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      songId,
      versionId,
    }: {
      songId: string;
      versionId: string;
    }) => deleteVersionAdmin(adminApi, songId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["versionsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
    },
  });
};

export const useSetCurrentVersion = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      songId,
      versionId,
    }: {
      songId: string;
      versionId: string;
    }) => setCurrentVersionAdmin(adminApi, songId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
    },
  });
};

export const useResetVersionDB = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resetVersionDB(adminApi),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["versionsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
    },
  });
};

export const useUpdateIllustration = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: IllustrationModifySchema;
    }) => updateIllustration(adminApi, id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["songDBAdmin"] });
      await queryClient.cancelQueries({ queryKey: ["illustrationsAdmin"] });

      // Snapshot previous values
      const previousSongs = queryClient.getQueryData<SongWithCurrentVersion[]>(["songDBAdmin"]);
      const previousIllustrations = queryClient.getQueryData<SongIllustrationDB[]>(["illustrationsAdmin"]);

      // Optimistically update illustrations
      if (previousIllustrations) {
        queryClient.setQueryData<SongIllustrationDB[]>(["illustrationsAdmin"], (old) =>
          old?.map(ill => 
            ill.id === id 
              ? { ...ill, imageModel: data.imageModel || ill.imageModel, imageURL: data.imageURL || ill.imageURL, thumbnailURL: data.thumbnailURL || ill.thumbnailURL }
              : ill
          ) || []
        );
      }

      // Optimistically update songs if setAsActive is being changed
      if (data.setAsActive !== undefined && previousSongs) {
        queryClient.setQueryData<SongWithCurrentVersion[]>(["songDBAdmin"], (old) =>
          old?.map(song => {
            const illustration = previousIllustrations?.find(ill => ill.id === id);
            if (illustration && illustration.songId === song.id) {
              return {
                ...song,
                currentIllustrationId: data.setAsActive ? id : (song.currentIllustrationId === id ? null : song.currentIllustrationId)
              };
            }
            return song;
          }) || []
        );
      }

      return { previousSongs, previousIllustrations };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousSongs) {
        queryClient.setQueryData(["songDBAdmin"], context.previousSongs);
      }
      if (context?.previousIllustrations) {
        queryClient.setQueryData(["illustrationsAdmin"], context.previousIllustrations);
      }
    },
    onSettled: () => {
      // Always refetch after success or error
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["illustrationsAdmin"] });
    },
  });
};

export const useDeleteIllustration = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteIllustration(adminApi, id);
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["illustrationsAdmin"] });
      
      const previousIllustrations = queryClient.getQueryData<SongIllustrationDB[]>(["illustrationsAdmin"]);
      
      // Optimistically mark as deleted
      queryClient.setQueryData<SongIllustrationDB[]>(["illustrationsAdmin"], (old) =>
        old?.map(ill => ill.id === id ? { ...ill, deleted: true } : ill) || []
      );

      return { previousIllustrations };
    },
    onError: (err, variables, context) => {
      if (context?.previousIllustrations) {
        queryClient.setQueryData(["illustrationsAdmin"], context.previousIllustrations);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["illustrationsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
    },
  });
};

export const useRestoreIllustration = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await restoreIllustration(adminApi, id);
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["illustrationsAdmin"] });
      
      const previousIllustrations = queryClient.getQueryData<SongIllustrationDB[]>(["illustrationsAdmin"]);
      
      // Optimistically mark as restored
      queryClient.setQueryData<SongIllustrationDB[]>(["illustrationsAdmin"], (old) =>
        old?.map(ill => ill.id === id ? { ...ill, deleted: false } : ill) || []
      );

      return { previousIllustrations };
    },
    onError: (err, variables, context) => {
      if (context?.previousIllustrations) {
        queryClient.setQueryData(["illustrationsAdmin"], context.previousIllustrations);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["illustrationsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
    },
  });
};

export const useCreateIllustration = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: IllustrationCreateSchema) =>
      createIllustration(adminApi, data),
    onSuccess: (response) => {
      // Update all relevant queries
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
      
      // Optimistically add the new illustration
      queryClient.setQueryData<SongIllustrationDB[]>(
        ["illustrationsAdmin"],
        (old) => (old ? [...old, response.illustration] : [response.illustration])
      );
      
      // Optimistically add the new prompt
      queryClient.setQueryData<IllustrationPromptDB[]>(
        ["promptsAdmin"],
        (old) => (old ? [...old, response.prompt] : [response.prompt])
      );
    },
  });
};

export const useGenerateIllustration = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: IllustrationGenerateSchema) =>
      generateIllustration(adminApi, data),
    onSuccess: (response) => {
      // Update all relevant queries
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
      
      // Optimistically add the new illustration
      queryClient.setQueryData<SongIllustrationDB[]>(
        ["illustrationsAdmin"],
        (old) => (old ? [...old, response.illustration] : [response.illustration])
      );
      
      // Optimistically add the new prompt
      queryClient.setQueryData<IllustrationPromptDB[]>(
        ["promptsAdmin"],
        (old) => (old ? [...old, response.prompt] : [response.prompt])
      );
    },
  });
};

export const useSetActiveIllustration = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      songId,
      illustrationId,
    }: {
      songId: string;
      illustrationId: string;
    }) => setActiveIllustration(adminApi, songId, illustrationId),
    onMutate: async ({ songId, illustrationId }) => {
      await queryClient.cancelQueries({ queryKey: ["songDBAdmin"] });
      
      const previousSongs = queryClient.getQueryData<SongWithCurrentVersion[]>(["songDBAdmin"]);
      
      // Optimistically update the current illustration
      queryClient.setQueryData<SongWithCurrentVersion[]>(["songDBAdmin"], (old) =>
        old?.map(song => 
          song.id === songId 
            ? { ...song, currentIllustrationId: illustrationId }
            : song
        ) || []
      );

      return { previousSongs };
    },
    onError: (err, variables, context) => {
      if (context?.previousSongs) {
        queryClient.setQueryData(["songDBAdmin"], context.previousSongs);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
    },
  });
};