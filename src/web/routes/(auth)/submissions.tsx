import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import SongVersionStatusBadge from "~/components/SongVersionStatusBadge";
import { makeApiRequest } from "~/services/api-service";
import { refreshSongVersions, versionAction } from "~/services/version-service";
import { versionLabel } from "src/lib/version-label";
import type { SongVersionApi } from "src/worker/api/api-types";
import { SongRevisionHistory } from "~/components/SongRevisionHistory";
import { useIsOnline } from "~/hooks/use-is-online";

export const Route = createFileRoute("/(auth)/submissions")({
  component: UserSubmissions,
  loader: ({ context }) => context.userData?.submissions ?? [],
});

function UserSubmissions() {
  const versions = Route.useLoaderData();
  const context = Route.useRouteContext();
  const router = useRouter();
  const cache = useQueryClient();
  const online = useIsOnline();
  const [filter, setFilter] = useState("active");
  const mutation = useMutation({
    mutationFn: async ({
      version,
      action,
    }: {
      version: SongVersionApi;
      action: "archive" | "restore" | "official" | "delete" | "publish";
    }) => {
      if (action === "delete")
        await makeApiRequest(() =>
          context.api.editor.versions[":id"].$delete({
            param: { id: version.id },
            json: { expectedRevision: version.revision },
          }),
        );
      else
        await versionAction(
          version.songId,
          version.id,
          action,
          version.revision,
        );
    },
    onSuccess: async (_, { version }) => {
      await refreshSongVersions(cache, version.songId);
      await router.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const displayed = versions
    .filter((v) =>
      filter === "active"
        ? ["published", "pending"].includes(v.status)
        : filter === "closed"
          ? ["rejected", "deleted"].includes(v.status) ||
            v.mergedIntoVersionId
          : v.status === "archived" && !v.mergedIntoVersionId,
    )
    .toSorted(
      (a, b) =>
        a.songId.localeCompare(b.songId) ||
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  const trusted =
    context.userData?.profile.isTrusted || context.userData?.profile.isAdmin;
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <h2 className="text-2xl font-bold">My Contributions</h2>
      <label className="flex min-w-0 items-center gap-2">
        Show{" "}
        <select
          className="min-w-0 flex-1 rounded border bg-background p-2"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="active">Active versions and submissions</option>
          <option value="archived">Archived versions</option>
          <option value="closed">
            Rejected, withdrawn and applied submissions
          </option>
        </select>
      </label>
      {displayed.map((version) => (
        <article
          key={version.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
        >
          <div className="min-w-0 space-y-1">
            <Link
              className="font-medium hover:underline"
              to="/song/$songId"
              params={{ songId: version.songId }}
              search={{ version: version.id }}
            >
              {version.title} · {version.artist}
            </Link>
            <p>
              {versionLabel(version)}{" "}
              {version.isOfficial && (
                <span className="text-sm text-primary">Official</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Updated {new Date(version.updatedAt).toLocaleString()}
            </p>
            <SongVersionStatusBadge status={version.status} />{" "}
            {version.mergedIntoVersionId && (
              <span className="text-xs">Revision applied</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!version.mergedIntoVersionId &&
              ["pending", "published", "archived"].includes(version.status) && (
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/edit/$songId"
                    params={{ songId: version.songId }}
                    search={{ version: version.id }}
                  >
                    Edit
                  </Link>
                </Button>
              )}
            <SongRevisionHistory
              songId={version.songId}
              versionId={version.id}
              ownerId={version.userId}
              currentRevision={version.revision}
              status={version.status} merged={!!version.mergedIntoVersionId}
            />
            {(
              [
                ...(version.status === "published" && !version.isOfficial
                  ? ["archive", ...(trusted ? ["official"] : [])]
                  : []),
                ...((version.status === "archived" &&
                  !version.mergedIntoVersionId) ||
                version.status === "rejected"
                  ? ["restore"]
                  : []),
                ...(version.status === "pending"
                  ? [
                      "delete",
                      ...(trusted &&
                      version.submissionIntent !== "update-parent"
                        ? ["publish"]
                        : []),
                    ]
                  : []),
              ] as ("archive" | "official" | "restore" | "delete" | "publish")[]
            ).map((action) => (
              <Button
                key={action}
                variant="outline"
                size="sm"
                disabled={!online || mutation.isPending}
                onClick={() => mutation.mutate({ version, action })}
              >
                {
                  {
                    archive: "Archive",
                    official: "Make official",
                    restore: "Restore",
                    delete: "Withdraw",
                    publish: "Publish",
                  }[action]
                }
              </Button>
            ))}
          </div>
        </article>
      ))}
      {!displayed.length && (
        <p className="p-6 text-muted-foreground">
          No contributions in this view.
        </p>
      )}
    </div>
  );
}
