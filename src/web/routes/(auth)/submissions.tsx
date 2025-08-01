import { createFileRoute, Link } from "@tanstack/react-router";
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
import { FilePenLine, GitMerge, Home, Trash2 } from "lucide-react";
import { cn } from "~/lib/utils";

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

  return (
    <div className="w-full">
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
              <TableCell>
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
                <Button variant="ghost" size="icon" disabled>
                  <Trash2 />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default UserSubmissions;
