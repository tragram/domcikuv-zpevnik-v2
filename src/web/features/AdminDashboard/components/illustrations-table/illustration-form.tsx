import type React from "react";
import { useState } from "react";
import {
  IllustrationApiResponse,
  IllustrationCreateSchema,
  IllustrationModifySchema,
} from "src/worker/api/admin/illustrations";
import { Button } from "~/components/shadcn-ui/button";
import { Input } from "~/components/shadcn-ui/input";
import { Label } from "~/components/shadcn-ui/label";
import { Switch } from "~/components/shadcn-ui/switch";

interface IllustrationFormProps {
  illustration: IllustrationApiResponse | null;
  onSave: (data: IllustrationCreateSchema | IllustrationModifySchema) => void;
  isLoading?: boolean;
}

export function IllustrationForm({
  illustration,
  onSave,
  isLoading,
}: IllustrationFormProps) {
  const [formData, setFormData] = useState({
    songId: illustration?.songId || "",
    promptId: illustration?.promptId || "",
    promptModel: illustration?.promptModel || "",
    imageModel: illustration?.imageModel || "",
    imageURL: illustration?.imageURL || "",
    thumbnailURL: illustration?.thumbnailURL || "",
    isActive: illustration?.isActive || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="songId">Song ID</Label>
        <Input
          id="songId"
          value={formData.songId}
          onChange={(e) => setFormData({ ...formData, songId: e.target.value })}
          required
          disabled={!!illustration} // Don't allow changing song ID when editing
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="promptModel">Prompt Model</Label>
          <Input
            id="promptModel"
            value={formData.promptModel}
            onChange={(e) =>
              setFormData({ ...formData, promptModel: e.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="imageModel">Image Model</Label>
          <Input
            id="imageModel"
            value={formData.imageModel}
            onChange={(e) =>
              setFormData({ ...formData, imageModel: e.target.value })
            }
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="promptId">Prompt ID</Label>
        <Input
          id="promptId"
          value={formData.promptId}
          onChange={(e) =>
            setFormData({ ...formData, promptId: e.target.value })
          }
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="imageURL">Image URL</Label>
        <Input
          id="imageURL"
          value={formData.imageURL}
          onChange={(e) =>
            setFormData({ ...formData, imageURL: e.target.value })
          }
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="thumbnailURL">Thumbnail URL</Label>
        <Input
          id="thumbnailURL"
          value={formData.thumbnailURL}
          onChange={(e) =>
            setFormData({ ...formData, thumbnailURL: e.target.value })
          }
          required
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, isActive: checked })
          }
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading
          ? "Saving..."
          : illustration
          ? "Update Illustration"
          : "Create Illustration"}
      </Button>
    </form>
  );
}
