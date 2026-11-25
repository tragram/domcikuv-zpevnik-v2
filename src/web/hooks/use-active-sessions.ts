import { queryOptions } from "@tanstack/react-query";
import { fetchActiveSessions } from "~/services/user-service";

export const activeSessionsQueryOptions = () =>
  queryOptions({
    queryKey: ["activeSessions"],
    queryFn: fetchActiveSessions,
    staleTime: 60_000,
  });
