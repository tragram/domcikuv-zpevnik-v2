import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Edit, ExternalLink, History } from "lucide-react";
import type { UserDB } from "src/lib/db/schema";
import type { SongVersionAdminApi } from "src/worker/api/api-types";
import SongVersionStatusBadge from "~/components/SongVersionStatusBadge";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { AdminApi } from "~/../worker/api-client";
import { useVersionsAdmin } from "../../../services/admin-hooks";
import { ExternalSourceBadge } from "./external-source-badge";

interface UserEditsDialogProps {
  adminApi: AdminApi;
  user: UserDB;
  onClose: () => void;
}

/**
 * Lists every song version authored by a single user, newest first, so an
 * admin can audit a person's contributions from the user directory.
 */
export function UserEditsDialog({
  adminApi,
  user,
  onClose,
}: UserEditsDialogProps) {
  const navigate = useNavigate({ from: "/admin" });
  const { data: versions, isLoading } = useVersionsAdmin(adminApi);

  const userVersions = useMemo(
    () =>
      (versions ?? [])
        .filter((v) => v.userId === user.id)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [versions, user.id],
  );

  const statusCounts = useMemo(() => {
    const counts = new Map<SongVersionAdminApi["status"], number>();
    userVersions.forEach((v) =>
      counts.set(v.status, (counts.get(v.status) ?? 0) + 1),
    );
    return [...counts.entries()];
  }, [userVersions]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[850px] p-0 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-6 bg-muted/30 border-b shrink-0">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <History className="w-6 h-6 text-primary" />
            Edits by {user.nickname || user.name}
          </DialogTitle>
          <DialogDescription className="mt-1">
            {isLoading
              ? "Loading edit history..."
              : `${userVersions.length} song version${
                  userVersions.length === 1 ? "" : "s"
                } submitted by this user.`}
          </DialogDescription>
          {statusCounts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {statusCounts.map(([status, count]) => (
                <span key={status} className="flex items-center gap-1.5">
                  <SongVersionStatusBadge status={status} />
                  <Badge variant="secondary" className="font-mono">
                    {count}
                  </Badge>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              Loading edit history...
            </div>
          ) : userVersions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              This user has not submitted any edits yet.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30 sticky top-0">
                <TableRow>
                  <TableHead>Song</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Created</TableHead>
                  <TableHead className="text-right pr-6 whitespace-nowrap">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userVersions.map((version) => (
                  <TableRow key={version.id} className="hover:bg-accent/30">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold">{version.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {version.artist}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <SongVersionStatusBadge status={version.status} />
                        {version.importSourceId && (
                          <ExternalSourceBadge
                            sourceId={version.importSourceId}
                            url={version.importUrl ?? "#"}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {new Date(version.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="View this version"
                          onClick={() =>
                            window.open(
                              `/song/${version.songId}?version=${version.id}`,
                              "_blank",
                            )
                          }
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Open in editor"
                          onClick={() =>
                            navigate({
                              to: "/edit/$songId",
                              params: { songId: version.songId },
                              search: { version: version.id },
                            })
                          }
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
