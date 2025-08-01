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
    },
  });
};

export const useDeleteSong = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (songId: string) => deleteSongAdmin(adminApi, songId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songsAdmin"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["illustrationsAdmin"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["illustrationsAdmin"] });
    },
  });
};

export const useCreateIllustration = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: IllustrationCreateSchema) =>
      createIllustration(adminApi, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
      queryClient.setQueryData<SongIllustrationDB[]>(
        ["illustrationsAdmin"],
        (old) => (old ? [...old, response.illustration] : old)
      );
      queryClient.setQueryData<IllustrationPromptDB[]>(
        ["promptsAdmin"],
        (old) => (old ? [...old, response.prompt] : old)
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
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
      queryClient.setQueryData<SongIllustrationDB[]>(
        ["illustrationsAdmin"],
        (old) => (old ? [...old, response.illustration] : old)
      );
      queryClient.setQueryData<IllustrationPromptDB[]>(
        ["promptsAdmin"],
        (old) => (old ? [...old, response.prompt] : old)
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
    },
  });
};
