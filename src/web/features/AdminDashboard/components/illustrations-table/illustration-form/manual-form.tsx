import { useRouteContext } from "@tanstack/react-router";
import { CheckCircle, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { IllustrationCreateSchema } from "src/worker/helpers/illustration-helpers";
import { ImageDropzone } from "~/components/ImageDropzone";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { useSongPrompts } from "~/features/AdminDashboard/adminHooks";
import { cn } from "~/lib/utils";
import type { IllustrationSubmitData } from "./illustration-form";
import { ActiveSwitch, SongIdField } from "./shared-form-fields";

interface ManualFormProps {
  illustration: any;
  activePromptId?: string;
  onSave: (data: IllustrationSubmitData) => void;
  isLoading?: boolean;
  onSuccess?: () => void;
}

// Helper to resize image
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
  const adminApi = useRouteContext({ from: "/admin" }).api.admin;
  const { songPrompts } = useSongPrompts(adminApi, illustration.songId);

  // --- State ---
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");
  const [thumbnailGenerating, setThumbnailGenerating] = useState(false);

  // Prompt handling
  const [selectedPromptId, setSelectedPromptId] = useState<string>(
    illustration?.promptId || activePromptId,
  );
  const [promptMode, setPromptMode] = useState<"existing" | "new">(
    songPrompts.length > 0 ? "existing" : "new",
  );
  const [newPromptText, setNewPromptText] = useState("");

  const [formData, setFormData] = useState<Partial<IllustrationCreateSchema>>({
    songId: illustration?.songId || "",
    imageModel: illustration?.imageModel || "",
    imageURL: illustration?.imageURL || "",
    thumbnailURL: illustration?.thumbnailURL || "",
    setAsActive: illustration?.setAsActive || false,
  });

  // --- Effects ---

  // Initialize Previews
  useEffect(() => {
    if (illustration?.imageURL && !imageFile) {
      setImagePreview(illustration.imageURL);
    }
    if (illustration?.thumbnailURL && !thumbnailFile) {
      setThumbnailPreview(illustration.thumbnailURL);
    }
  }, [illustration, imageFile, thumbnailFile]);

  // Paste Listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith("image/")) {
          e.preventDefault();
          handleImageSelection(file);
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []); // Empty deps effectively, but handleImageSelection is stable enough or we can use ref if needed.

  // --- Handlers ---

  const updateFormData = (updates: Partial<IllustrationCreateSchema>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleImageSelection = async (file: File) => {
    // 1. Set Main Image
    setImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    updateFormData({ imageURL: "" }); // Clear URL if file is present

    // 2. Auto-generate Thumbnail
    setThumbnailGenerating(true);
    try {
      const generatedThumbnail = await resizeImageToThumbnail(file);
      setThumbnailFile(generatedThumbnail);
      setThumbnailPreview(URL.createObjectURL(generatedThumbnail));
      updateFormData({ thumbnailURL: "" });
    } catch (error) {
      console.error("Error generating thumbnail:", error);
    } finally {
      setThumbnailGenerating(false);
    }
  };

  const handleThumbnailSelection = (file: File) => {
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
    updateFormData({ thumbnailURL: "" });
  };

  const clearImageFile = () => {
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    // Also clear thumbnail if it was auto-generated from this image
    if (thumbnailPreview && thumbnailPreview.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailPreview);
      setThumbnailFile(null);
      setThumbnailPreview(illustration?.thumbnailURL || "");
    }

    setImageFile(null);
    setImagePreview(illustration?.imageURL || "");

    // Reset file input value if it exists
    const input = document.getElementById("image-upload") as HTMLInputElement;
    if (input) input.value = "";
  };

  const clearThumbnailFile = () => {
    if (thumbnailPreview && thumbnailPreview.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailPreview);
    }
    setThumbnailFile(null);
    setThumbnailPreview(illustration?.thumbnailURL || "");

    const input = document.getElementById(
      "thumbnail-upload",
    ) as HTMLInputElement;
    if (input) input.value = "";
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
      onSuccess?.();
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full">
      <SongIdField
        songId={formData.songId || ""}
        onSongIdChange={(value) => updateFormData({ songId: value })}
        mode="manual"
      />

      {/* --- PROMPT SECTION --- */}
      <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
        <Label className="text-base font-semibold">Illustration Prompt</Label>

        <RadioGroup
          value={promptMode}
          onValueChange={(v: "existing" | "new") => setPromptMode(v)}
          className="flex flex-col gap-4 mt-2"
        >
          {/* Existing Prompt */}
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
                Existing prompt ({songPrompts.length})
              </Label>
            </div>

            {promptMode === "existing" && (
              <div className="pl-6 space-y-2">
                <Select
                  value={selectedPromptId}
                  onValueChange={setSelectedPromptId}
                >
                  <SelectTrigger className="w-full bg-background">
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
              </div>
            )}
          </div>

          {/* New Prompt */}
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="new" id="mode-new" />
              <Label htmlFor="mode-new">Custom prompt</Label>
            </div>
            {promptMode === "new" && (
              <div className="pl-6 space-y-3">
                <Textarea
                  placeholder="Enter prompt text..."
                  value={newPromptText}
                  onChange={(e) => setNewPromptText(e.target.value)}
                  className="min-h-[100px] bg-background"
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

      {/* --- IMAGE UPLOAD SECTION --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Main Image Column */}
        <div className="space-y-3">
          <Label>Main Image</Label>

          <div className="relative">
            <ImageDropzone
              id="image-upload"
              label={imageFile ? imageFile.name : "Upload Main Image"}
              onFileSelect={handleImageSelection}
              previewUrl={imagePreview}
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

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or using URL
              </span>
            </div>
          </div>

          <Input
            placeholder="https://..."
            value={formData.imageURL}
            onChange={(e) => updateFormData({ imageURL: e.target.value })}
            disabled={!!imageFile}
            className="text-xs font-mono"
          />
        </div>

        {/* Thumbnail Column */}
        <div className="space-y-3">
          <Label>Thumbnail (128x128)</Label>

          {/* Scenario A: Main Image is uploaded -> Auto Generate State */}
          {imageFile ? (
            <div className="h-[200px] border-2 border-dashed border-green-200 bg-green-50/50 rounded-lg flex flex-col items-center justify-center p-4 text-center space-y-3">
              {thumbnailGenerating ? (
                <>
                  <Loader2 className="h-8 w-8 text-green-600 animate-spin" />
                  <p className="text-sm font-medium text-green-700">
                    Generating thumbnail...
                  </p>
                </>
              ) : (
                <>
                  <div className="relative">
                    <img
                      src={thumbnailPreview}
                      className="w-24 h-24 rounded border shadow-sm object-cover"
                      alt="Thumbnail Preview"
                    />
                    <div className="absolute -bottom-2 -right-2 bg-green-100 text-green-700 rounded-full p-1">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-xs text-green-700 font-medium">
                    Auto-generated from main image
                  </p>
                </>
              )}
            </div>
          ) : (
            /* Scenario B: No Main Image -> Manual Upload State */
            <>
              <div className="relative">
                <ImageDropzone
                  id="thumbnail-upload"
                  label={
                    thumbnailFile ? thumbnailFile.name : "Upload Thumbnail"
                  }
                  onFileSelect={handleThumbnailSelection}
                  previewUrl={thumbnailPreview}
                />
                {thumbnailFile && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={clearThumbnailFile}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or using URL
                  </span>
                </div>
              </div>

              <Input
                placeholder="https://..."
                value={formData.thumbnailURL}
                onChange={(e) =>
                  updateFormData({ thumbnailURL: e.target.value })
                }
                disabled={!!thumbnailFile}
                className="text-xs font-mono"
              />
            </>
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
