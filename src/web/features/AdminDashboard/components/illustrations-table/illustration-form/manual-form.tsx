import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { IllustrationPromptApi } from "src/worker/api/api-types";
import { IllustrationCreateSchema } from "src/worker/api/api-types";
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
import { cn } from "~/lib/utils";
import type { IllustrationFormProps } from "./illustration-form";
import { ActiveSwitch, SongIdField } from "./shared-form-fields";

interface ManualFormProps extends IllustrationFormProps {
  songPrompts: IllustrationPromptApi[];
}

export function ManualForm({
  illustration,
  activePromptId,
  onSave,
  isLoading,
  onSuccess,
  songPrompts,
}: ManualFormProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  // Prompt handling
  const [selectedPromptId, setSelectedPromptId] = useState<string | undefined>(
    activePromptId ?? (songPrompts.length > 0 ? songPrompts[0].id : undefined),
  );
  const [promptMode, setPromptMode] = useState<"existing" | "new">(
    songPrompts.length > 0 ? "existing" : "new",
  );
  const [newPromptText, setNewPromptText] = useState("");

  const [formData, setFormData] = useState<IllustrationCreateSchema>({
    songId: illustration?.songId || "",
    imageModel:
      illustration?.imageModel ||
      (typeof window !== "undefined"
        ? sessionStorage.getItem("admin-manual-imageModel")
        : "") ||
      "",
    setAsActive: true,
  });

  // --- Effects ---
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
  }, []);

  // --- Handlers ---
  const updateFormData = (updates: Partial<IllustrationCreateSchema>) => {
    if (updates.imageModel !== undefined) {
      sessionStorage.setItem(
        "admin-manual-imageModel",
        updates.imageModel || "",
      );
    }
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleImageSelection = (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImageFile = () => {
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(null);

    const input = document.getElementById("image-upload") as HTMLInputElement;
    if (input) input.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...formData };
    if (imageFile) data.imageFile = imageFile;

    // Attach prompt data
    if (promptMode === "existing" && selectedPromptId) {
      data.promptId = selectedPromptId;
    } else {
      data.promptText = newPromptText;
      data.summaryModel = "manual";
      data.summaryPromptVersion = "manual";
    }

    try {
      onSave({
        mode: "manual",
        illustrationData: data,
      });
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

      <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
        <Label className="text-base font-semibold">Illustration Prompt</Label>

        <RadioGroup
          value={promptMode}
          onValueChange={(v: "existing" | "new") => setPromptMode(v)}
          className="flex flex-col gap-4 mt-2"
        >
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
                  disabled={!selectedPromptId}
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

      <div className="space-y-3">
        <Label>Main Image</Label>
        <div className="relative">
          <ImageDropzone
            label={imageFile ? imageFile.name : "Upload or paste Image"}
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
      </div>

      <ActiveSwitch
        isActive={formData.setAsActive || false}
        onActiveChange={(checked) => updateFormData({ setAsActive: checked })}
        mode="manual"
      />

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading || (!imageFile && !illustration)}
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
