import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { makeApiRequest } from "../../services/apiHelpers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import { FilePenLine, GitMerge } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { DeletePrompt } from "~/features/AdminDashboard/components/shared/delete-prompt";

export const Route = createFileRoute("/(auth)/submissions")({
  component: UserSubmissions,
  loader: ({ context }) =>
    makeApiRequest(() => context.api.editor["submissions"].$get()),
});

interface SongVersion {
  id: string;
  songId: string;
  title: string;
  artist: string;
  approved: boolean;
  createdAt?: string;
}

function UserSubmissions() {
  const versions = Route.useLoaderData();
  const context = Route.useRouteContext();
  const router = useRouter();

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      makeApiRequest(() =>
        context.api.editor[":id"].$delete({
          param: { id },
        })
      ),
    onSuccess: () => {
      router.invalidate();
    },
  });

  return (
    <div className="max-w-3xl w-[80vw]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Song</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(versions ?? []).map((version: SongVersion) => (
            <TableRow key={version.id}>
              <TableCell>
                <Link
                  to="/song/$songId"
                  params={{
                    songId: version.songId,
                  }}
                  className="hover:underline"
                >
                  {version.title} - {version.artist}
                </Link>
              </TableCell>
              <TableCell>
                {version.approved ? (
                  <span className="text-primary flex items-center gap-2">
                    <GitMerge /> Approved
                  </span>
                ) : (
                  "Pending"
                )}
              </TableCell>
              <TableCell>
                {version.createdAt
                  ? new Date(version.createdAt).toLocaleDateString()
                  : "N/A"}
              </TableCell>
              <TableCell className="flex gap-1">
                <Button asChild variant="ghost" size="icon">
                  <Link
                    to="/edit/$songId"
                    params={{
                      songId: version.songId,
                    }}
                  >
                    <FilePenLine />
                  </Link>
                </Button>
                <DeletePrompt
                  onDelete={() => deleteMutation.mutate(version.id)}
                  title="Delete this version?"
                  description="This action cannot be undone. This will permanently delete your version."
                  variant="ghost"
                  disabled={version.approved}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default UserSubmissions;
