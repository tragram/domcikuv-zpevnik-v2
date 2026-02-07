import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { FilePenLine } from "lucide-react";
import { useState } from "react";
import DeletePrompt from "~/components/dialogs/delete-prompt";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { makeApiRequest } from "~/services/api-service";
import SongVersionStatusBadge from "~/components/SongVersionStatusBadge";
import { SongVersionDB } from "src/lib/db/schema";

export const Route = createFileRoute("/(auth)/submissions")({
  component: UserSubmissions,
  loader: ({ context }) =>
    makeApiRequest(() => context.api.editor["submissions"].$get()),
});

function UserSubmissions() {
  const versions = Route.useLoaderData() as SongVersionDB[];
  const context = Route.useRouteContext();
  const router = useRouter();
  const [showAllVersions, setShowAllVersions] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      makeApiRequest(() =>
        context.api.editor.versions[":id"].$delete({
          param: { id },
        }),
      ),
    onSuccess: () => {
      router.invalidate();
    },
  });

  // Filter to show only the latest version per song, or organize by song if showing all
  const displayedVersions = showAllVersions
    ? versions?.sort((a, b) => {
        // First sort by songId to group versions together
        if (a.songId !== b.songId) {
          return a.songId.localeCompare(b.songId);
        }
        // Then sort by date descending within each song group
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      })
    : versions?.reduce((acc, version) => {
        const existingIndex = acc.findIndex((v) => v.songId === version.songId);
        if (existingIndex === -1) {
          acc.push(version);
        } else {
          // Compare dates and keep the latest version
          const existingDate = new Date(acc[existingIndex].createdAt || 0);
          const currentDate = new Date(version.createdAt || 0);
          if (currentDate > existingDate) {
            acc[existingIndex] = version;
          }
        }
        return acc;
      }, [] as SongVersionDB[]);

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">My Contributions</h2>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {showAllVersions
              ? "Showing all submission versions"
              : "Showing only the latest version of each song"}
          </p>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-all-versions"
              checked={showAllVersions}
              onCheckedChange={(checked) =>
                setShowAllVersions(checked === true)
              }
            />
            <Label
              htmlFor="show-all-versions"
              className="cursor-pointer text-sm"
            >
              Show all versions
            </Label>
          </div>
        </div>
      </div>
      <div className="rounded-md border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Song</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted On</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(displayedVersions ?? []).map((version, index) => {
              // Determine if this is a new song group (for visual grouping when showing all versions)
              const prevVersion =
                index > 0 ? displayedVersions[index - 1] : null;
              const isFirstInGroup =
                showAllVersions &&
                (!prevVersion || prevVersion.songId !== version.songId);
              const nextVersion =
                index < displayedVersions.length - 1
                  ? displayedVersions[index + 1]
                  : null;
              const isLastInGroup =
                showAllVersions &&
                (!nextVersion || nextVersion.songId !== version.songId);

              return (
                <TableRow
                  key={version.id}
                  className={`
                    ${isFirstInGroup ? "border-t-primary/20" : ""}
                    ${showAllVersions && !isLastInGroup ? "border-b-0" : ""}
                    ${showAllVersions && !isFirstInGroup ? "bg-muted/30" : ""}
                  `}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex flex-col ${showAllVersions && !isFirstInGroup ? "ml-4" : ""}`}
                      >
                        <Link
                          to={"/song/$songId"}
                          params={{ songId: version.songId }}
                          search={{ version: version.id }}
                          className="hover:underline text-base"
                        >
                          {version.title}
                        </Link>
                        <span className="text-sm text-muted-foreground">
                          {version.artist}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <SongVersionStatusBadge status={version.status} />
                  </TableCell>
                  <TableCell className="text-center">
                    {version.createdAt
                      ? new Date(version.createdAt).toLocaleDateString()
                      : "N/A"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end items-center gap-1">
                      <Button asChild size="sm">
                        <Link
                          to="/edit/$songId"
                          params={{ songId: version.songId }}
                          search={{ version: version.id }}
                        >
                          <FilePenLine className="w-4 h-4 mr-1" />
                        </Link>
                      </Button>

                      {/* Disable delete for published/archived history to preserve lineage */}
                      <DeletePrompt
                        onDelete={() => deleteMutation.mutate(version.id)}
                        title="Withdraw Submission?"
                        description="Are you sure you want to delete this version? This cannot be undone."
                        variant="ghost"
                        size="sm"
                        disabled={version.status !== "pending"}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {displayedVersions && displayedVersions.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-8 text-muted-foreground"
                >
                  You haven't submitted any songs or edits yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default UserSubmissions;
