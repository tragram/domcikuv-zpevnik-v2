import type React from "react";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Upload, X, CheckCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SongIdField, ActiveSwitch } from "./shared-form-fields";
import type { IllustrationSubmitData } from "./illustration-form";
import { IllustrationCreateSchema } from "src/worker/helpers/illustration-helpers";
import { cn } from "~/lib/utils";
import { useSongPrompts } from "~/features/AdminDashboard/adminHooks";
import { useRouteContext } from "@tanstack/react-router";
interface ManualFormProps {
  illustration: any;
  activePromptId?: string;
  onSave: (data: IllustrationSubmitData) => void;
  isLoading?: boolean;
  onSuccess?: () => void;
}

const resizeImageToThumbnail = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
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
          } else {
            reject(new Error("Failed to generate thumbnail"));
          }
        },
        file.type,
        0.8,
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.crossOrigin = "anonymous";
    img.src = URL.createObjectURL(file);
  });
};

export function ManualForm({
  illustration,
  activePromptId,
  onSave,
  isLoading,
  onSuccess,
}: ManualFormProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");
  const [thumbnailGenerating, setThumbnailGenerating] = useState(false);

  // Prompt handling state
  const [promptMode, setPromptMode] = useState<"existing" | "new">("existing");
  const [selectedPromptId, setSelectedPromptId] = useState<string>("");
  const [newPromptText, setNewPromptText] = useState("");
  const [manualModel, setManualModel] = useState("manual");
  const [manualVersion, setManualVersion] = useState("v1-manual");
  const adminApi = useRouteContext({ from: "/admin" }).api.admin;
  const { songPrompts } = useSongPrompts(adminApi, illustration.songId);

  const [formData, setFormData] = useState<Partial<IllustrationCreateSchema>>({
    songId: illustration?.songId || "",
    imageModel: illustration?.imageModel || "",
    imageURL: illustration?.imageURL || "",
    thumbnailURL: illustration?.thumbnailURL || "",
    setAsActive: illustration?.setAsActive || false,
  });

  // Set initial previews from existing data
  useEffect(() => {
    if (illustration?.imageURL && !imageFile) {
      setImagePreview(illustration.imageURL);
    }
    if (illustration?.thumbnailURL && !thumbnailFile) {
      setThumbnailPreview(illustration.thumbnailURL);
    }
  }, [
    illustration?.imageURL,
    illustration?.thumbnailURL,
    imageFile,
    thumbnailFile,
  ]);

  // Set initial prompt selection
  useEffect(() => {
    const targetPromptId = illustration?.promptId || activePromptId;
    if (targetPromptId && songPrompts.some((p) => p.id === targetPromptId)) {
      setPromptMode("existing");
      setSelectedPromptId(targetPromptId);
    } else if (songPrompts.length > 0 && !selectedPromptId) {
      setSelectedPromptId(songPrompts[0].id);
    } else if (songPrompts.length === 0) {
      setPromptMode("new");
    }
  }, [illustration?.promptId, activePromptId, songPrompts, selectedPromptId]);

  const updateFormData = (updates: Partial<IllustrationCreateSchema>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleImageFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);

      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);

      setThumbnailGenerating(true);
      try {
        const generatedThumbnail = await resizeImageToThumbnail(file);
        setThumbnailFile(generatedThumbnail);

        const thumbnailPreviewUrl = URL.createObjectURL(generatedThumbnail);
        setThumbnailPreview(thumbnailPreviewUrl);

        updateFormData({ imageURL: "", thumbnailURL: "" });
      } catch (error) {
        console.error("Error generating thumbnail:", error);
      } finally {
        setThumbnailGenerating(false);
      }
    }
  };

  const handleThumbnailFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);

      const previewUrl = URL.createObjectURL(file);
      setThumbnailPreview(previewUrl);

      updateFormData({ thumbnailURL: "" });
    }
  };

  const clearImageFile = () => {
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    if (thumbnailPreview && thumbnailPreview.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailPreview);
    }

    setImageFile(null);
    setThumbnailFile(null);
    setImagePreview(illustration?.imageURL || "");
    setThumbnailPreview(illustration?.thumbnailURL || "");

    const imageInput = document.getElementById(
      "image-upload",
    ) as HTMLInputElement;
    if (imageInput) imageInput.value = "";
  };

  const clearThumbnailFile = () => {
    if (thumbnailPreview && thumbnailPreview.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailPreview);
    }

    setThumbnailFile(null);
    setThumbnailPreview(illustration?.thumbnailURL || "");

    const thumbnailInput = document.getElementById(
      "thumbnail-upload",
    ) as HTMLInputElement;
    if (thumbnailInput) thumbnailInput.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = { ...formData };
    if (imageFile) data.imageFile = imageFile;
    if (thumbnailFile) data.thumbnailFile = thumbnailFile;

    // Attach prompt data
    if (promptMode === "existing" && selectedPromptId) {
      data.promptId = selectedPromptId;
    } else {
      data.promptText = newPromptText;
      data.summaryModel = "manual";
      data.summaryPromptVersion = "manual";
    }

    try {
      await onSave({ mode: "manual", illustrationData: data });

      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
      if (thumbnailPreview && thumbnailPreview.startsWith("blob:")) {
        URL.revokeObjectURL(thumbnailPreview);
      }

      onSuccess?.();
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
      if (thumbnailPreview && thumbnailPreview.startsWith("blob:")) {
        URL.revokeObjectURL(thumbnailPreview);
      }
    };
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full">
      <SongIdField
        songId={formData.songId || ""}
        onSongIdChange={(value) => updateFormData({ songId: value })}
        mode="manual"
      />

      {/* PROMPT SELECTION UI */}
      <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
        <Label className="text-base font-semibold">Illustration Prompt</Label>

        <RadioGroup
          value={promptMode}
          onValueChange={(v: "existing" | "new") => setPromptMode(v)}
          className="flex flex-col gap-4 mt-2"
        >
          {/* Existing Prompt Option */}
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="existing"
                id="mode-existing"
                disabled={songPrompts.length === 0}
              />
              <Label
                htmlFor="mode-existing"
                className={cn(
                  songPrompts.length === 0 && "text-muted-foreground",
                )}
              >
                Existing prompt ({songPrompts.length} in total)
              </Label>
            </div>

            {promptMode === "existing" && (
              <div className="pl-6 space-y-2">
                <Select
                  value={selectedPromptId}
                  onValueChange={setSelectedPromptId}
                >
                  <SelectTrigger className="w-full  bg-background">
                    <SelectValue placeholder="Select a prompt..." />
                  </SelectTrigger>
                  <SelectContent>
                    {songPrompts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="font-mono text-xs text-muted-foreground mr-2">
                          [{p.summaryModel}]
                        </span>
                        {p.text.length > 50
                          ? p.text.substring(0, 50) + "..."
                          : p.text}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPromptId && (
                  <p className="text-xs text-muted-foreground p-2 bg-background rounded border">
                    {songPrompts.find((p) => p.id === selectedPromptId)?.text}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* New Prompt Option */}
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="new" id="mode-new" />
              <Label htmlFor="mode-new">Custom prompt</Label>
            </div>

            {promptMode === "new" && (
              <div className="pl-6 space-y-3">
                <Textarea
                  placeholder="Enter the exact prompt text used to generate the image..."
                  value={newPromptText}
                  onChange={(e) => setNewPromptText(e.target.value)}
                  className="min-h-[100px] bg-background text-white/50"
                  required={promptMode === "new"}
                />
              </div>
            )}
          </div>
        </RadioGroup>
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

          {/* Image Preview */}
          {imagePreview && (
            <div className="mt-2">
              <img
                src={imagePreview}
                alt="Image preview"
                className="w-full max-w-xs h-auto rounded border object-cover"
              />
            </div>
          )}
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
              {thumbnailGenerating ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-green-500 border-t-transparent rounded-full"></div>
                  <span className="text-sm text-green-700">
                    Generating thumbnail...
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-700">
                    Thumbnail auto-generated from uploaded image (128x128)
                  </span>
                </>
              )}
            </div>
          ) : !imageFile ? (
            <>
              <div className="text-sm text-muted-foreground text-center">
                or
              </div>
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

          {/* Thumbnail Preview */}
          {thumbnailPreview && (
            <div className="mt-2">
              <img
                src={thumbnailPreview}
                alt="Thumbnail preview"
                className="w-32 h-32 rounded border object-cover"
              />
            </div>
          )}
        </div>
      </div>

      <ActiveSwitch
        isActive={formData.setAsActive || false}
        onActiveChange={(checked) => updateFormData({ setAsActive: checked })}
        mode="manual"
      />

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading || thumbnailGenerating}
      >
        {isLoading
          ? "Saving..."
          : illustration
            ? "Update Illustration"
            : "Create Illustration"}
      </Button>
    </form>
  );
}
