import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { FilePenLine } from "lucide-react";
import DeletePrompt from "~/components/dialogs/delete-prompt";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { makeApiRequest } from "../../services/apiHelpers";
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

  return (
    <div className="max-w-4xl mx-auto w-full">
      <h2 className="text-2xl font-bold mb-6">My Contributions</h2>
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
            {(versions ?? []).map((version) => (
              <TableRow key={version.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <Link
                      to="/song/$songId"
                      params={{ songId: version.songId }}
                      className="hover:underline text-base"
                    >
                      {version.title}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {version.artist}
                    </span>
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
                      disabled={
                        version.status === "published" ||
                        version.status === "archived"
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {versions && versions.length === 0 && (
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
