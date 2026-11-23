import { useId, useState } from "react";
import { toast } from "sonner";
import type { SongVersionAdminApi } from "src/worker/api/api-types";
import type { AdminApi } from "src/worker/api-client";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useChangeVersionAuthor, useUsersAdmin } from "~/services/admin-hooks";
import { Pagination } from "./shared/pagination";

const PAGE_SIZE = 10;

export function VersionAuthor({ adminApi, version, online, onClose }: {
  adminApi: AdminApi;
  version: SongVersionAdminApi;
  online: boolean;
  onClose: () => void;
}) {
  const [revision] = useState(version.revision);
  const changeAuthor = useChangeVersionAuthor(adminApi);

  return (
    <Dialog open onOpenChange={(open) => {
      if (!open && !changeAuthor.isPending) onClose();
    }}>
      <AuthorPicker
        adminApi={adminApi}
        version={version}
        disabled={!online}
        saving={changeAuthor.isPending}
        error={changeAuthor.error?.message}
        onCancel={onClose}
        onSave={(userId) => changeAuthor.mutate({
          songId: version.songId,
          versionId: version.id,
          expectedRevision: revision,
          userId,
        }, {
          onSuccess: () => {
            onClose();
            toast.success("Version author updated");
          },
        })}
      />
    </Dialog>
  );
}

function AuthorPicker({ adminApi, version, disabled, saving, error, onCancel, onSave }: {
  adminApi: AdminApi;
  version: SongVersionAdminApi;
  disabled: boolean;
  saving: boolean;
  error?: string;
  onCancel: () => void;
  onSave: (userId: string) => void;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const users = useUsersAdmin(adminApi, { limit: PAGE_SIZE, offset: page * PAGE_SIZE, search: search.trim() || undefined });
  const pagination = users.data?.pagination;
  const canSave = !disabled && !saving && !!selectedId;

  return (
    <DialogContent showCloseButton={!saving}>
      <DialogHeader>
        <DialogTitle>Change version author</DialogTitle>
        <DialogDescription>Current author is {version.authorName}.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <Label htmlFor={id}>Search by name, nickname, or email</Label>
        <Input id={id} type="search" value={search} disabled={saving} onChange={(event) => {
          setSearch(event.target.value);
          setPage(0);
          setSelectedId("");
        }} />
        {users.isPending && <p role="status" className="text-sm text-muted-foreground">Loading users…</p>}
        {users.isError && <p role="alert" className="text-sm text-destructive">{users.error.message}</p>}
        {users.data?.users.length === 0 && <p className="text-sm text-muted-foreground">No users found.</p>}
        {users.data && users.data.users.length > 0 && (
          <fieldset className="max-h-64 space-y-1 overflow-y-auto" disabled={saving}>
            <legend className="sr-only">New author</legend>
            {users.data.users.map((user) => (
              <label key={user.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                <input type="radio" name={id} checked={selectedId === user.id}
                  disabled={user.id === version.userId} onChange={() => setSelectedId(user.id)} />
                <span className="min-w-0 break-words">
                  {user.nickname || user.name}
                  <span className="block text-xs text-muted-foreground">{user.email}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {pagination && pagination.totalPages > 1 && (
          <Pagination currentPage={page} totalPages={pagination.totalPages}
            hasNextPage={!saving && pagination.hasMore} hasPrevPage={!saving && page > 0}
            totalItems={pagination.total} pageSize={PAGE_SIZE} onPageChange={(nextPage) => {
              setPage(nextPage);
              setSelectedId("");
            }} />
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>Cancel</Button>
        <Button type="button" disabled={!canSave} onClick={() => onSave(selectedId)}>
          {saving ? "Saving…" : "Save author"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
