import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_RULES_MESSAGE,
  nicknameError,
} from "src/lib/nickname";
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
import { useUserData } from "~/hooks/use-user-data";
import { useViewSettingsStore } from "../hooks/viewSettingsStore";
import { ApiException, handleApiResponse } from "~/services/api-service";

interface SetNicknameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the saved nickname after a successful update. */
  onSaved?: (nickname: string) => void;
}

/**
 * Controlled dialog for setting/changing the user's nickname inline (without
 * navigating to the full profile page). A nickname is required to share a
 * session — it is the handle a feed is addressed by (`/feed/:nickname`).
 *
 * Rendered as a sibling of (not nested in) the dropdown that triggers it, so its
 * portal isn't torn down when the dropdown closes.
 */
export function SetNicknameDialog({
  open,
  onOpenChange,
  onSaved,
}: SetNicknameDialogProps) {
  const { userData } = useUserData();
  const queryClient = useQueryClient();
  const setShareSession = useViewSettingsStore((s) => s.actions.setShareSession);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  // Seed the input with the current nickname each time the dialog opens.
  useEffect(() => {
    if (open) {
      setValue(userData?.profile.nickname ?? "");
      setError(undefined);
    }
  }, [open, userData?.profile.nickname]);

  if (!userData) return null;
  const profile = userData.profile;

  const save = async () => {
    const trimmed = value.trim();
    const validationError = nicknameError(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(undefined);
    try {
      // The profile endpoint validates the whole profile, so resend the existing
      // name and privacy setting unchanged alongside the new nickname.
      const formData = new FormData();
      formData.append("name", profile.name);
      formData.append("nickname", trimmed);
      formData.append("isFavoritesPublic", String(profile.isFavoritesPublic));

      const response = await fetch("/api/profile", {
        method: "PUT",
        body: formData,
      });
      await handleApiResponse(response);

      await queryClient.invalidateQueries({ queryKey: ["session"] });
      // Nickname is the session handle — turn sharing on automatically now that
      // the user has one (the whole point of opening this dialog).
      setShareSession(true);
      toast.success("Nickname saved — session sharing enabled");
      onOpenChange(false);
      onSaved?.(trimmed);
    } catch (err) {
      if (err instanceof ApiException && err.code === "NICKNAME_TAKEN") {
        setError(err.message);
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to save nickname",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {profile.nickname ? "Change your nickname" : "Set a nickname"}
          </DialogTitle>
          <DialogDescription>
            Your nickname is the link others use to watch your live session:{" "}
            <span className="font-mono">/feed/{value.trim() || "nickname"}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label
            htmlFor="set-nickname-input"
            className={error ? "text-destructive" : ""}
          >
            Nickname
          </Label>
          <Input
            id="set-nickname-input"
            autoFocus
            value={value}
            maxLength={NICKNAME_MAX_LENGTH}
            placeholder="e.g. domcik"
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !saving) save();
            }}
            className={
              error ? "border-destructive focus-visible:ring-destructive" : ""
            }
          />
          <p
            className={`text-xs ${error ? "text-destructive font-medium" : "text-muted-foreground"}`}
          >
            {error ?? NICKNAME_RULES_MESSAGE}
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || value.trim().length === 0}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SetNicknameDialog;
