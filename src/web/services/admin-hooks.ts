import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { refreshSongVersions, type VersionMutationInput } from "./version-service";
import { songQueryKeys } from "./song-query-keys";
import { SongDataDB } from "src/lib/db/schema";
import { AdminApi } from "src/worker/api-client";
import type {
  ModifySongVersionSchema,
  SongModificationSchema,
} from "src/worker/api/admin/songs";
import type {
  IllustrationCreateSchema,
  IllustrationGenerateInput,
  IllustrationModifySchema,
  IllustrationPromptApi,
  PromptGenerateSchema,
  SongIllustrationApi,
} from "src/worker/api/api-types";
import {
  DEFAULT_ILLUSTRATION_MODELS,
  IMAGE_MODELS_API,
  SUMMARY_MODELS_API,
  SUMMARY_PROMPT_VERSIONS,
  type IllustrationDefaults,
} from "src/lib/contracts/image-generation";
import type {
  CreateUserSchema,
  UpdateUserSchema,
  UserRoleFilter,
  UsersResponse,
} from "src/worker/helpers/user-helpers";
import { makeApiRequest } from "~/services/api-service";
import {
  deleteVersionAdmin,
  getSongsAdmin,
  getVersionsAdmin,
  parseDBDates,
  patchSongAdmin,
  patchVersionAdmin,
  resetVersionDB,
  songsWithCurrentVersionAdmin,
} from "~/services/song-service";
import {
  createUserAdmin,
  deleteUserAdmin,
  fetchUsersAdmin,
  setUserPasswordAdmin,
  updateUserAdmin,
} from "~/services/user-service";
import {
  fetchIllustrationsAdmin,
  fetchPromptsAdmin,
  updateIllustration,
  deleteIllustration,
  restoreIllustration,
  createIllustration,
  generateIllustration,
  songsWithIllustrationsAndPrompts,
} from "./illustration-service";

export const useSongsAdmin = (adminApi: AdminApi) =>
  useQuery({
    queryKey: songQueryKeys.adminSongs,
    queryFn: () => getSongsAdmin(adminApi),
    refetchOnMount: "always",
  });

export const useSongDBAdmin = (adminApi: AdminApi) =>
  useQuery({
    queryKey: songQueryKeys.adminCatalog,
    queryFn: () => songsWithCurrentVersionAdmin(adminApi),
    refetchOnMount: "always",
  });

export const useIllustrationsAdmin = (adminApi: AdminApi) =>
  useQuery({
    queryKey: ["illustrationsAdmin"],
    queryFn: () => fetchIllustrationsAdmin(adminApi),
    refetchOnMount: "always",
  });

export const usePromptsAdmin = (adminApi: AdminApi) =>
  useQuery({
    queryKey: ["promptsAdmin"],
    queryFn: () => fetchPromptsAdmin(adminApi),
    refetchOnMount: "always",
  });

export const useVersionsAdmin = (adminApi: AdminApi) =>
  useQuery({
    queryKey: songQueryKeys.adminVersions,
    queryFn: () => getVersionsAdmin(adminApi),
    refetchOnMount: "always",
  });

export const useUsersAdmin = (
  adminApi: AdminApi,
  params: {
    limit: number;
    offset: number;
    search?: string;
    role?: UserRoleFilter;
  },
) =>
  useQuery({
    queryKey: [
      "usersAdmin",
      params.limit,
      params.offset,
      params.search,
      params.role,
    ],
    queryFn: () => fetchUsersAdmin(adminApi.users, params),
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
      queryClient.invalidateQueries({ queryKey: songQueryKeys.catalog });
      queryClient.invalidateQueries({ queryKey: songQueryKeys.adminSongs });
      queryClient.invalidateQueries({ queryKey: songQueryKeys.adminCatalog });
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
      queryClient.invalidateQueries({ queryKey: songQueryKeys.catalog });
      queryClient.invalidateQueries({ queryKey: songQueryKeys.adminSongs });
      queryClient.invalidateQueries({ queryKey: songQueryKeys.adminCatalog });
      queryClient.invalidateQueries({ queryKey: songQueryKeys.submissions });
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
      queryClient.invalidateQueries({ queryKey: songQueryKeys.catalog });
      queryClient.invalidateQueries({ queryKey: songQueryKeys.adminSongs });
      queryClient.invalidateQueries({ queryKey: songQueryKeys.adminCatalog });
      queryClient.invalidateQueries({ queryKey: songQueryKeys.submissions });
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
    onSuccess: (_, { songId }) => refreshSongVersions(queryClient, songId),
  });
};

export const useChangeVersionAuthor = (adminApi: AdminApi) => {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: ({ songId, versionId, expectedRevision, userId }: VersionMutationInput & { userId: string }) =>
      makeApiRequest(() => adminApi.songs[":songId"].versions[":versionId"].author.$patch({
        param: { songId, versionId },
        json: { expectedRevision, userId },
      })),
    onSuccess: (_, { songId }) => refreshSongVersions(cache, songId),
  });
};

export const useDeleteVersion = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      songId,
      versionId,
      expectedRevision,
    }: VersionMutationInput) => deleteVersionAdmin(adminApi, songId, versionId, expectedRevision),
    onSuccess: (_, { songId }) => refreshSongVersions(queryClient, songId),
  });
};

export const useRestoreVersion = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      songId,
      versionId,
      expectedRevision,
      fallbackStatus,
    }: VersionMutationInput & { fallbackStatus?: "published" | "archived" | "pending" }) => {
      return makeApiRequest(() =>
        adminApi.songs[":songId"].versions[":versionId"][":action"].$post({ param: { songId, versionId, action: "restore" }, json: { expectedRevision, fallbackStatus },
        }),
      );
    },
    onSuccess: (_, { songId }) => refreshSongVersions(queryClient, songId),
  });
};

export const useResetVersionDB = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resetVersionDB(adminApi),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: songQueryKeys.catalog });
      queryClient.invalidateQueries({ queryKey: songQueryKeys.adminSongs });
      queryClient.invalidateQueries({ queryKey: songQueryKeys.adminVersions });
      queryClient.invalidateQueries({ queryKey: songQueryKeys.adminCatalog });
      queryClient.invalidateQueries({ queryKey: songQueryKeys.submissions });
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
      queryClient.invalidateQueries({ queryKey: songQueryKeys.catalog });
      await queryClient.cancelQueries({ queryKey: songQueryKeys.adminCatalog });
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
          songQueryKeys.adminCatalog,
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
        queryClient.setQueryData(songQueryKeys.adminCatalog, context.previousSongs);
      }
      if (context?.previousIllustrations) {
        queryClient.setQueryData(
          ["illustrationsAdmin"],
          context.previousIllustrations,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: songQueryKeys.adminCatalog });
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
      queryClient.invalidateQueries({ queryKey: songQueryKeys.catalog });
      queryClient.invalidateQueries({ queryKey: ["illustrationsAdmin"] });
      queryClient.invalidateQueries({ queryKey: songQueryKeys.adminCatalog });
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
      queryClient.invalidateQueries({ queryKey: songQueryKeys.adminCatalog });
    },
  });
};

export const useCreateIllustration = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: IllustrationCreateSchema) =>
      createIllustration(adminApi, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: songQueryKeys.catalog });
      queryClient.invalidateQueries({ queryKey: songQueryKeys.adminCatalog });

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
    mutationFn: (data: IllustrationGenerateInput) =>
      generateIllustration(adminApi, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: songQueryKeys.catalog });
      queryClient.invalidateQueries({ queryKey: songQueryKeys.adminCatalog });

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
  const cache = useQueryClient();
  return useMutation({
    mutationFn: ({ songId, versionId, expectedRevision, official, force, expectedOfficialId, expectedTargetRevision, makeOfficial, archivePrevious }: VersionMutationInput & {
      official?: boolean; force?: boolean; expectedOfficialId?: string | null; expectedTargetRevision?: number; makeOfficial?: boolean; archivePrevious?: boolean;
    }) => {
      const route = adminApi.songs[":songId"].versions[":versionId"];
      return official
        ? makeApiRequest(() => route.official.$post({ param: { songId, versionId }, json: { expectedRevision } }))
        : makeApiRequest(() => route.approve.$post({ param: { songId, versionId }, json: { expectedRevision, force, expectedOfficialId, expectedTargetRevision, makeOfficial, archivePrevious } }));
    },
    onSuccess: (_, { songId }) => refreshSongVersions(cache, songId),
  });
};

export const useRejectVersion = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      songId,
      versionId,
      expectedRevision,
    }: VersionMutationInput) => {
      return makeApiRequest(() =>
        adminApi.songs[":songId"].versions[":versionId"][":action"].$post({ param: { songId, versionId, action: "reject" }, json: { expectedRevision },
        }),
      );
    },
    onSuccess: (_, { songId }) => refreshSongVersions(queryClient, songId),
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

      queryClient.setQueriesData(
        { queryKey: ["usersAdmin"] },
        (old: UsersResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            users: old.users.map((user) =>
              user.id === userId ? { ...user, ...userData } : user,
            ),
          };
        },
      );

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

export const useSetUserPassword = (adminApi: AdminApi) => {
  // No cache invalidation: the password isn't part of any cached user view.
  return useMutation({
    mutationFn: ({
      userId,
      newPassword,
    }: {
      userId: string;
      newPassword: string;
    }) => setUserPasswordAdmin(adminApi.users, userId, newPassword),
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

      queryClient.setQueriesData(
        { queryKey: ["usersAdmin"] },
        (old: UsersResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            users: old.users.filter((user) => user.id !== userId),
            pagination: {
              ...old.pagination,
              total: old.pagination.total - 1,
            },
          };
        },
      );

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
    if (!prompts) return [];
    if (!songId) return prompts;
    else return prompts.filter((p) => p.songId === songId);
  }, [prompts, songId]);

  return { songPrompts, isLoading };
};

const illustrationDefaultsQueryKey = ["illustrationDefaults"];

export const useIllustrationDefaults = (adminApi: AdminApi) =>
  useQuery({
    queryKey: illustrationDefaultsQueryKey,
    queryFn: () => makeApiRequest(() => adminApi.illustrations.defaults.$get()),
  });

export const useSaveIllustrationDefaults = (adminApi: AdminApi) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (defaults: IllustrationDefaults) =>
      makeApiRequest(() => adminApi.illustrations.defaults.$put({ json: defaults })),
    onSuccess: (defaults) => {
      queryClient.setQueryData(illustrationDefaultsQueryKey, defaults);
    },
  });
};

export const useIllustrationOptions = (adminApi: AdminApi) => {
  const { data = DEFAULT_ILLUSTRATION_MODELS } = useIllustrationDefaults(adminApi);
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
        default: data.summaryModel,
      },
      imageModels: {
        data: IMAGE_MODELS_API.map((im) => ({ value: im, label: im })),
        default: data.imageModel,
      },
    }),
    [data],
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
    ].sort((a, b) => a.localeCompare(b));
    const summaryModels = [
      ...new Set(promptsQuery.data?.map((p) => p.summaryModel) || []),
    ].sort((a, b) => a.localeCompare(b));
    const promptVersions = [
      ...new Set(promptsQuery.data?.map((p) => p.summaryPromptVersion) || []),
    ].sort((a, b) => a.localeCompare(b));

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
