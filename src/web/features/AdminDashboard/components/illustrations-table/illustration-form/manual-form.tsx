// manual-form.tsx
import type React from "react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Upload, X } from "lucide-react";
import { SongIdField, ActiveSwitch } from "./shared-form-fields";
import type { IllustrationSubmitData } from "./illustration-form";
import { IllustrationCreateSchema } from "src/worker/services/illustration-service";

interface ManualFormProps {
  illustration: any;
  onSave: (data: IllustrationSubmitData) => void;
  isLoading?: boolean;
  dropdownOptions: any;
}

const resizeImageToThumbnail = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const img = new Image();

    img.onload = () => {
      canvas.width = 128;
      canvas.height = 128;
      ctx.drawImage(img, 0, 0, 128, 128);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const thumbnailFile = new File([blob], `thumb_${file.name}`, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(thumbnailFile);
          }
        },
        file.type,
        0.8
      );
    };

    img.crossOrigin = "anonymous";
    img.src = URL.createObjectURL(file);
  });
};

export function ManualForm({
  illustration,
  onSave,
  isLoading,
}: ManualFormProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<IllustrationCreateSchema>({
    songId: illustration?.songId || "",
    summaryPromptId: illustration?.summaryPromptId || "",
    imageModel: illustration?.imageModel || "",
    imageURL: illustration?.imageURL || "",
    thumbnailURL: illustration?.thumbnailURL || "",
    setAsActive: illustration?.isActive || false,
  });

  const updateFormData = (updates: Partial<IllustrationCreateSchema>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      try {
        const thumbnailFile = await resizeImageToThumbnail(file);
        setThumbnailFile(thumbnailFile);
        updateFormData({ imageURL: "", thumbnailURL: "" });
      } catch (error) {
        console.error("Error generating thumbnail:", error);
      }
    }
  };

  const handleThumbnailFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      updateFormData({ thumbnailURL: "" });
    }
  };

  const clearImageFile = () => {
    setImageFile(null);
    setThumbnailFile(null);
    const imageInput = document.getElementById("image-upload") as HTMLInputElement;
    if (imageInput) imageInput.value = "";
  };

  const clearThumbnailFile = () => {
    setThumbnailFile(null);
    const thumbnailInput = document.getElementById("thumbnail-upload") as HTMLInputElement;
    if (thumbnailInput) thumbnailInput.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...formData };
    if (imageFile) data.imageFile = imageFile;
    if (thumbnailFile) data.thumbnailFile = thumbnailFile;
    onSave({ mode: "manual", illustrationData: data });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SongIdField
        songId={formData.songId}
        onSongIdChange={(value) => updateFormData({ songId: value })}
        mode="manual"
      />

      <div className="space-y-2">
        <Label htmlFor="manual-promptId">Prompt ID (Optional)</Label>
        <Input
          id="manual-promptId"
          value={formData.summaryPromptId}
          onChange={(e) => updateFormData({ summaryPromptId: e.target.value })}
          placeholder="Leave empty to auto-generate a manual prompt"
        />
        <p className="text-sm text-muted-foreground">
          If left empty, a manual prompt will be created automatically. Otherwise, provide an existing prompt ID.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="manual-imageModel">Image Model</Label>
        <Input
          id="manual-imageModel"
          value={formData.imageModel}
          onChange={(e) => updateFormData({ imageModel: e.target.value })}
          required
        />
      </div>

      {/* Image Upload Section */}
      <div className="space-y-2">
        <Label>Image</Label>
        <div className="space-y-2">
          <Input
            placeholder="Image URL"
            value={formData.imageURL}
            onChange={(e) => updateFormData({ imageURL: e.target.value })}
            disabled={!!imageFile}
          />
          <div className="text-sm text-muted-foreground text-center">or</div>
          <div className="relative">
            <Input
              type="file"
              accept="image/*"
              onChange={handleImageFileChange}
              className="hidden"
              id="image-upload"
            />
            <Label
              htmlFor="image-upload"
              className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-muted-foreground/25 rounded-md cursor-pointer hover:border-muted-foreground/50 transition-colors"
            >
              <Upload className="h-4 w-4" />
              {imageFile ? imageFile.name : "Upload Image"}
            </Label>
            {imageFile && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="absolute top-2 right-2 h-8 w-8 p-0 bg-transparent"
                onClick={clearImageFile}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Thumbnail Upload Section */}
      <div className="space-y-2">
        <Label>Thumbnail</Label>
        <div className="space-y-2">
          <Input
            placeholder="Thumbnail URL"
            value={formData.thumbnailURL}
            onChange={(e) => updateFormData({ thumbnailURL: e.target.value })}
            disabled={!!thumbnailFile || !!imageFile}
          />
          {imageFile && thumbnailFile ? (
            <div className="flex items-center gap-2 p-4 border-2 border-dashed border-green-200 rounded-md bg-green-50">
              <div className="h-4 w-4 rounded-full bg-green-500"></div>
              <span className="text-sm text-green-700">
                Thumbnail auto-generated from uploaded image (128x128)
              </span>
            </div>
          ) : !imageFile ? (
            <>
              <div className="text-sm text-muted-foreground text-center">or</div>
              <div className="relative">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailFileChange}
                  className="hidden"
                  id="thumbnail-upload"
                />
                <Label
                  htmlFor="thumbnail-upload"
                  className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-muted-foreground/25 rounded-md cursor-pointer hover:border-muted-foreground/50 transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  {thumbnailFile ? thumbnailFile.name : "Upload Thumbnail"}
                </Label>
                {thumbnailFile && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2 h-8 w-8 p-0 bg-transparent"
                    onClick={clearThumbnailFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <ActiveSwitch
        isActive={formData.setAsActive}
        onActiveChange={(checked) => updateFormData({ setAsActive: checked })}
        mode="manual"
      />

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Saving..." : illustration ? "Update Illustration" : "Create Illustration"}
      </Button>
    </form>
  );
}