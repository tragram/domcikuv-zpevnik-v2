import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AdminApi,
  createIllustration,
  deleteIllustration,
  restoreIllustration,
  deleteVersionAdmin,
  fetchIllustrationsAdmin,
  fetchPromptsAdmin,
  generateIllustration,
  getSongsAdmin,
  getVersionsAdmin,
  patchSongAdmin,
  patchVersionAdmin,
  resetVersionDB,
  songsWithCurrentVersionAdmin,
  updateIllustration,
  songsWithIllustrationsAndPrompts,
  parseDBDates,
} from "~/services/song-service";
import {
  createUserAdmin,
  deleteUserAdmin,
  fetchUsersAdmin,
  updateUserAdmin,
} from "~/services/user-service";
import {
  ModifySongVersionSchema,
  SongModificationSchema,
} from "src/worker/api/admin/songs";
import { useMemo } from "react";
import {
  IMAGE_MODELS_API,
  SUMMARY_MODELS_API,
  SUMMARY_PROMPT_VERSIONS,
} from "src/worker/helpers/image-generator";
import {
  IllustrationModifySchema,
  IllustrationCreateSchema,
  IllustrationGenerateSchema,
} from "src/worker/helpers/illustration-helpers";
import {
  CreateUserSchema,
  UpdateUserSchema,
} from "src/worker/helpers/user-helpers";
import { makeApiRequest } from "~/services/api-service";
import {
  IllustrationPromptApi,
  SongDataApi,
  SongIllustrationApi,
  UserApi,
} from "src/worker/api/api-types";
import { PromptGenerateSchema } from "src/worker/api/admin/illustration-prompts";
import { SongDataDB } from "src/lib/db/schema";

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
    staleTime: 1000 * 60 * 60,
  });

export const useIllustrationsAdmin = (adminApi: AdminApi) =>
  useQuery({
    queryKey: ["illustrationsAdmin"],
    queryFn: () => fetchIllustrationsAdmin(adminApi),
    staleTime: 1000 * 60 * 60,
  });

export const usePromptsAdmin = (adminApi: AdminApi) =>
  useQuery({
    queryKey: ["promptsAdmin"],
    queryFn: () => fetchPromptsAdmin(adminApi),
    staleTime: 1000 * 60 * 60,
  });

export const useVersionsAdmin = (adminApi: AdminApi) =>
  useQuery({
    queryKey: ["versionsAdmin"],
    queryFn: () => getVersionsAdmin(adminApi),
    staleTime: 1000 * 60 * 60,
  });

export const useUsersAdmin = (
  adminApi: AdminApi,
  params: { limit: number; offset: number; search?: string },
) =>
  useQuery({
    queryKey: ["usersAdmin", params.limit, params.offset, params.search],
    queryFn: () => fetchUsersAdmin(adminApi.users, params),
    staleTime: 1000 * 60 * 60,
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
    }) => patchSongAdmin(adminApi, songId, song),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
    },
  });
};

export const useDeleteSong = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (songId: string) => {
      return makeApiRequest(() =>
        adminApi.songs[":id"].$delete({ param: { id: songId } }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
    },
  });
};

export const useRestoreSong = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (songId: string) => {
      return makeApiRequest(() =>
        adminApi.songs[":id"].restore.$post({ param: { id: songId } }),
      );
    },
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
      version: ModifySongVersionSchema;
    }) => patchVersionAdmin(adminApi, songId, versionId, version),
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

export const useRestoreVersion = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      songId,
      versionId,
    }: {
      songId: string;
      versionId: string;
    }) => {
      return makeApiRequest(() =>
        adminApi.songs[":songId"].versions[":versionId"].restore.$post({
          param: { songId, versionId },
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["versionsAdmin"] });
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
      await queryClient.cancelQueries({ queryKey: ["songDBAdmin"] });
      await queryClient.cancelQueries({ queryKey: ["illustrationsAdmin"] });

      // Ensure we query using the new flat DTO types
      const previousSongs = queryClient.getQueryData<SongDataDB[]>([
        "songDBAdmin",
      ]);
      const previousIllustrations = queryClient.getQueryData<
        SongIllustrationApi[]
      >(["illustrationsAdmin"]);

      if (previousIllustrations) {
        queryClient.setQueryData<SongIllustrationApi[]>(
          ["illustrationsAdmin"],
          (old) =>
            old?.map((ill) =>
              ill.id === id
                ? {
                    ...ill,
                    imageModel: data.imageModel || ill.imageModel,
                  }
                : ill,
            ) || [],
        );
      }

      if (data.setAsActive !== undefined && previousSongs) {
        queryClient.setQueryData<SongDataDB[]>(
          ["songDBAdmin"],
          (old) =>
            old?.map((song) => {
              const illustration = previousIllustrations?.find(
                (ill) => ill.id === id,
              );
              if (illustration && illustration.songId === song.id) {
                return {
                  ...song,
                  currentIllustrationId: data.setAsActive
                    ? id
                    : song.currentIllustrationId === id
                      ? null
                      : song.currentIllustrationId,
                };
              }
              return song;
            }) || [],
        );
      }

      return { previousSongs, previousIllustrations };
    },
    onError: (err, variables, context) => {
      if (context?.previousSongs) {
        queryClient.setQueryData(["songDBAdmin"], context.previousSongs);
      }
      if (context?.previousIllustrations) {
        queryClient.setQueryData(
          ["illustrationsAdmin"],
          context.previousIllustrations,
        );
      }
    },
    onSettled: () => {
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

      const previousIllustrations = queryClient.getQueryData<
        SongIllustrationApi[]
      >(["illustrationsAdmin"]);

      queryClient.setQueryData<SongIllustrationApi[]>(
        ["illustrationsAdmin"],
        (old) =>
          old?.map((ill) =>
            ill.id === id ? { ...ill, deleted: true } : ill,
          ) || [],
      );

      return { previousIllustrations };
    },
    onError: (err, variables, context) => {
      if (context?.previousIllustrations) {
        queryClient.setQueryData(
          ["illustrationsAdmin"],
          context.previousIllustrations,
        );
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

      const previousIllustrations = queryClient.getQueryData<
        SongIllustrationApi[]
      >(["illustrationsAdmin"]);

      queryClient.setQueryData<SongIllustrationApi[]>(
        ["illustrationsAdmin"],
        (old) =>
          old?.map((ill) =>
            ill.id === id ? { ...ill, deleted: false } : ill,
          ) || [],
      );

      return { previousIllustrations };
    },
    onError: (err, variables, context) => {
      if (context?.previousIllustrations) {
        queryClient.setQueryData(
          ["illustrationsAdmin"],
          context.previousIllustrations,
        );
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
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });

      queryClient.setQueryData<SongIllustrationApi[]>(
        ["illustrationsAdmin"],
        (old) =>
          old ? [...old, response.illustration] : [response.illustration],
      );

      queryClient.setQueryData<IllustrationPromptApi[]>(
        ["promptsAdmin"],
        (old) => (old ? [...old, response.prompt] : [response.prompt]),
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

      queryClient.setQueryData<SongIllustrationApi[]>(
        ["illustrationsAdmin"],
        (old) =>
          old ? [...old, response.illustration] : [response.illustration],
      );

      queryClient.setQueryData<IllustrationPromptApi[]>(
        ["promptsAdmin"],
        (old) => (old ? [...old, response.prompt] : [response.prompt]),
      );
    },
  });
};

export const useApproveVersion = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      songId,
      versionId,
    }: {
      songId: string;
      versionId: string;
    }) => {
      return makeApiRequest(() =>
        adminApi.songs[":songId"].versions[":versionId"].approve.$post({
          param: { songId, versionId },
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["versionsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
    },
  });
};

export const useRejectVersion = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      songId,
      versionId,
    }: {
      songId: string;
      versionId: string;
    }) => {
      return makeApiRequest(() =>
        adminApi.songs[":songId"].versions[":versionId"].reject.$post({
          param: { songId, versionId },
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["versionsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
    },
  });
};

export const useCreateUser = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userData: CreateUserSchema) =>
      createUserAdmin(adminApi.users, userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usersAdmin"] });
    },
  });
};

export const useUpdateUser = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      userData,
    }: {
      userId: string;
      userData: UpdateUserSchema;
    }) => updateUserAdmin(adminApi.users, userId, userData),
    onMutate: async ({ userId, userData }) => {
      await queryClient.cancelQueries({ queryKey: ["usersAdmin"] });

      const previousData = queryClient.getQueriesData({
        queryKey: ["usersAdmin"],
      });

      queryClient.setQueriesData({ queryKey: ["usersAdmin"] }, (old: any) => {
        if (!old?.users) return old;
        return {
          ...old,
          users: old.users.map((user: UserApi) =>
            user.id === userId ? { ...user, ...userData } : user,
          ),
        };
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["usersAdmin"] });
    },
  });
};

export const useDeleteUser = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => deleteUserAdmin(adminApi.users, userId),
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: ["usersAdmin"] });

      const previousData = queryClient.getQueriesData({
        queryKey: ["usersAdmin"],
      });

      queryClient.setQueriesData({ queryKey: ["usersAdmin"] }, (old: any) => {
        if (!old?.users) return old;
        return {
          ...old,
          users: old.users.filter((user: UserApi) => user.id !== userId),
          pagination: {
            ...old.pagination,
            total: old.pagination.total - 1,
          },
        };
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["usersAdmin"] });
    },
  });
};

export const useCreatePrompt = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      songId: string;
      summaryModel: string;
      summaryPromptVersion: string;
      text: string;
    }) => {
      return makeApiRequest(() =>
        adminApi.prompts.create.$post({ json: data }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promptsAdmin"] });
    },
  });
};

export const useUpdatePrompt = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => {
      return makeApiRequest(() =>
        adminApi.prompts[":id"].$put({
          param: { id },
          json: { text },
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promptsAdmin"] });
    },
  });
};

export const useDeletePrompt = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      return makeApiRequest(() =>
        adminApi.prompts[":id"].$delete({
          param: { id },
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promptsAdmin"] });
    },
  });
};

export const useSongPrompts = (adminApi: AdminApi, songId?: string) => {
  const { data: prompts, isLoading } = usePromptsAdmin(adminApi);

  const songPrompts = useMemo(() => {
    if (!prompts || !songId) return [];
    return prompts.filter((p) => p.songId === songId);
  }, [prompts, songId]);

  return { songPrompts, isLoading };
};

export const useIllustrationOptions = () => {
  return useMemo(
    () => ({
      promptVersions: {
        data: SUMMARY_PROMPT_VERSIONS.map((spi) => ({
          value: spi,
          label: spi,
        })),
        default: SUMMARY_PROMPT_VERSIONS[0],
      },
      summaryModels: {
        data: SUMMARY_MODELS_API.map((smi) => ({ value: smi, label: smi })),
        default: SUMMARY_MODELS_API[0],
      },
      imageModels: {
        data: IMAGE_MODELS_API.map((im) => ({ value: im, label: im })),
        default: IMAGE_MODELS_API[0],
      },
    }),
    [],
  );
};

export const useIllustrationsTableData = (adminApi: AdminApi) => {
  const songsQuery = useSongDBAdmin(adminApi);
  const illustrationsQuery = useIllustrationsAdmin(adminApi);
  const promptsQuery = usePromptsAdmin(adminApi);

  const isLoading =
    songsQuery.isLoading ||
    illustrationsQuery.isLoading ||
    promptsQuery.isLoading;

  const isError =
    songsQuery.isError || illustrationsQuery.isError || promptsQuery.isError;

  const error =
    songsQuery.error || illustrationsQuery.error || promptsQuery.error;

  const promptsById = useMemo(() => {
    if (!promptsQuery.data) return new Map();
    return new Map(promptsQuery.data.map((p) => [p.id, p]));
  }, [promptsQuery.data]);

  const filterOptions = useMemo(() => {
    const imageModels = [
      ...new Set(illustrationsQuery.data?.map((i) => i.imageModel) || []),
    ];
    const summaryModels = [
      ...new Set(promptsQuery.data?.map((p) => p.summaryModel) || []),
    ];
    const promptVersions = [
      ...new Set(promptsQuery.data?.map((p) => p.summaryPromptVersion) || []),
    ];

    return { imageModels, summaryModels, promptVersions };
  }, [illustrationsQuery.data, promptsQuery.data]);

  const groupedData = useMemo(() => {
    if (!songsQuery.data || !illustrationsQuery.data || !promptsQuery.data) {
      return {};
    }
    return songsWithIllustrationsAndPrompts(
      songsQuery.data,
      illustrationsQuery.data.map(parseDBDates),
      promptsQuery.data.map(parseDBDates),
    );
  }, [songsQuery.data, illustrationsQuery.data, promptsQuery.data]);

  return {
    songs: songsQuery.data,
    illustrations: illustrationsQuery.data,
    prompts: promptsQuery.data,
    groupedData,
    promptsById,
    filterOptions,
    isLoading,
    isError,
    error,
  };
};

export const useGeneratePrompt = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PromptGenerateSchema) => {
      return makeApiRequest(() =>
        adminApi.prompts.generate.$post({ json: data }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promptsAdmin"] });
    },
  });
};
