import { Pencil } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { editorSubmitSchema } from "src/lib/contracts/editor-schema";
import type { SongVersionDB } from "src/lib/db/schema";
import { versionLabel } from "src/lib/version-label";
import type { AdminApi } from "src/worker/api-client";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useUpdateVersion } from "~/services/admin-hooks";

export function VersionRename({
  adminApi,
  version,
  online,
}: {
  adminApi: AdminApi;
  version: SongVersionDB;
  online: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState<{
    name: string;
    originalLabel: string | null;
    revision: number;
  } | null>(null);
  const rename = useUpdateVersion(adminApi);
  const label = editorSubmitSchema.shape.label.safeParse(draft?.name);

  return (
    <Dialog
      open={draft !== null}
      onOpenChange={(open) => {
        if (rename.isPending) return;
        rename.reset();
        setDraft(open ? {
          name: version.label ?? "",
          originalLabel: version.label || null,
          revision: version.revision,
        } : null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Rename version “${versionLabel(version)}”`}
          title="Rename version"
          disabled={!online}
        >
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      {draft && (
        <DialogContent showCloseButton={!rename.isPending}>
          <DialogHeader>
            <DialogTitle>Rename version</DialogTitle>
            <DialogDescription>Use up to 20 characters. Leave blank to use the default name.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!online || rename.isPending || !label.success || label.data === draft.originalLabel) return;
              rename.mutate({
                songId: version.songId,
                versionId: version.id,
                version: { label: label.data, expectedRevision: draft.revision },
              }, {
                onSuccess: () => {
                  setDraft(null);
                  toast.success("Version name updated");
                },
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={id}>Version name</Label>
              <Input
                id={id}
                value={draft.name}
                placeholder={versionLabel({ ...version, label: null })}
                disabled={rename.isPending}
                aria-invalid={!label.success}
                aria-describedby={!label.success ? `${id}-error` : undefined}
                onChange={(event) => {
                  rename.reset();
                  setDraft({ ...draft, name: event.target.value });
                }}
              />
              {!label.success && (
                <p id={`${id}-error`} className="text-sm text-destructive">{label.error.issues[0].message}</p>
              )}
              {rename.isError && (
                <p role="alert" className="text-sm text-destructive">{rename.error.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={rename.isPending} onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!online || rename.isPending || !label.success || label.data === draft.originalLabel}
              >
                {rename.isPending ? "Saving…" : "Save name"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
