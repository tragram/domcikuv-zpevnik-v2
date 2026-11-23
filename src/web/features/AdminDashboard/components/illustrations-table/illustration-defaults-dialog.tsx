import { useState } from "react";
import {
  IMAGE_MODELS_API,
  SUMMARY_MODELS_API,
  type IllustrationDefaults,
} from "src/lib/contracts/image-generation";
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
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  useIllustrationDefaults,
  useSaveIllustrationDefaults,
} from "~/services/admin-hooks";

export function IllustrationDefaultsDialog({ adminApi }: { adminApi: AdminApi }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<IllustrationDefaults>>({});
  const defaults = useIllustrationDefaults(adminApi);
  const save = useSaveIllustrationDefaults(adminApi);
  const summaryModel = draft.summaryModel ?? defaults.data?.summaryModel;
  const imageModel = draft.imageModel ?? defaults.data?.imageModel;
  const changed =
    summaryModel !== defaults.data?.summaryModel ||
    imageModel !== defaults.data?.imageModel;

  const changeOpen = (next: boolean) => {
    if (save.isPending) return;
    setDraft({});
    save.reset();
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Generation Defaults</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generation Defaults</DialogTitle>
          <DialogDescription>
            Set the prompt and image models used for automatic illustrations.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!summaryModel || !imageModel || !changed || save.isPending) return;
            save.mutate({ summaryModel, imageModel }, {
              onSuccess: () => {
                setDraft({});
                setOpen(false);
              },
            });
          }}
        >
          {defaults.isPending && <p role="status">Loading defaults…</p>}
          {defaults.isError && (
            <p role="alert" className="text-destructive">Could not load defaults.</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="default-prompt-model">Prompt Model</Label>
            <Select
              value={summaryModel ?? ""}
              disabled={!defaults.data || save.isPending}
              onValueChange={(model: IllustrationDefaults["summaryModel"]) =>
                setDraft((previous) => ({ ...previous, summaryModel: model }))
              }
            >
              <SelectTrigger id="default-prompt-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUMMARY_MODELS_API.map((model) => (
                  <SelectItem key={model} value={model}>{model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="default-image-model">Image Model</Label>
            <Select
              value={imageModel ?? ""}
              disabled={!defaults.data || save.isPending}
              onValueChange={(model: IllustrationDefaults["imageModel"]) =>
                setDraft((previous) => ({ ...previous, imageModel: model }))
              }
            >
              <SelectTrigger id="default-image-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_MODELS_API.map((model) => (
                  <SelectItem key={model} value={model}>{model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {save.isError && (
            <p role="alert" className="text-destructive">Could not save defaults.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={save.isPending} onClick={() => changeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!defaults.data || !changed || save.isPending}>
              {save.isPending ? "Saving…" : "Save Defaults"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
