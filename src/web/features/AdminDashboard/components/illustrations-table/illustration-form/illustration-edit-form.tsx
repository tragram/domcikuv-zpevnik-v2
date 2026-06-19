import { X } from "lucide-react";
import { useState } from "react";
import { SongIllustrationDB } from "src/lib/db/schema";
import { IllustrationModifySchema } from "src/worker/api/api-types";
import { ImageDropzone } from "~/components/ImageDropzone";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import { ActiveSwitch } from "./shared-form-fields";

interface IllustrationEditFormProps {
  illustration: SongIllustrationDB;
  isActive: boolean;
  onSave: (data: IllustrationModifySchema) => void;
  isLoading?: boolean;
}

/**
 * Slim edit form matching exactly what the update endpoint supports:
 * replace the image file, relabel the image model, and toggle active.
 * Regeneration / prompt changes are not possible via update, so they are
 * intentionally absent here (use "Add Illustration" to generate a new one).
 */
export function IllustrationEditForm({
  illustration,
  isActive,
  onSave,
  isLoading,
}: IllustrationEditFormProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageModel, setImageModel] = useState(illustration.imageModel);
  const [setAsActive, setSetAsActive] = useState(isActive);

  const handleImageSelection = (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImageFile = () => {
    if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: IllustrationModifySchema = { imageModel, setAsActive };
    if (imageFile) data.imageFile = imageFile;
    onSave(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full">
      <div className="space-y-3">
        <Label>Image</Label>
        <div className="relative">
          <ImageDropzone
            label={imageFile ? imageFile.name : "Replace image"}
            onFileSelect={handleImageSelection}
            previewUrl={imagePreview || illustration.imageURL}
            className={cn(imageFile && "border-green-500/50 bg-green-50/10")}
          />
          {imageFile && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={clearImageFile}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Leave unchanged to keep the current image.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-imageModel">Image Model</Label>
        <Input
          id="edit-imageModel"
          value={imageModel}
          onChange={(e) => setImageModel(e.target.value)}
          required
        />
      </div>

      <ActiveSwitch
        isActive={setAsActive}
        onActiveChange={setSetAsActive}
        mode="manual"
      />

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Saving..." : "Update Illustration"}
      </Button>
    </form>
  );
}
