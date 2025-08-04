import type React from "react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  SongIdField,
  ActiveSwitch,
  ImageModelSelect,
} from "./shared-form-fields";
import type { IllustrationSubmitData } from "./illustration-form";
import { IllustrationGenerateSchema } from "src/worker/services/illustration-service";

interface AIGeneratedFormProps {
  illustration: {
    songId?: string;
    summaryPromptVersion?: "v1" | "v2";
    summaryModel?: "gpt-4o" | "gpt-4o-mini";
    imageModel?: "FLUX.1-dev";
    isActive?: boolean;
  } | null;
  onSave: (data: IllustrationSubmitData) => void;
  isLoading?: boolean;
  dropdownOptions: {
    promptVersions: {
      default: string;
      data: { value: string; label: string }[];
    };
    summaryModels: {
      default: string;
      data: { value: string; label: string }[];
    };
    imageModels: {
      default: string;
      data: { value: string; label: string }[];
    };
  };
  onSuccess?: () => void;
}

export function AIGeneratedForm({
  illustration,
  onSave,
  isLoading,
  dropdownOptions,
  onSuccess,
}: AIGeneratedFormProps) {
  const [formData, setFormData] = useState<Partial<IllustrationGenerateSchema>>(
    {
      songId: illustration?.songId || "",
      promptVersion:
        (illustration?.summaryPromptVersion ||
          dropdownOptions.promptVersions.default) as "v1" | "v2",
      summaryModel:
        (illustration?.summaryModel ||
          dropdownOptions.summaryModels.default) as "gpt-4o" | "gpt-4o-mini",
      imageModel:
        (illustration?.imageModel ||
          dropdownOptions.imageModels.default) as "FLUX.1-dev",
      setAsActive: illustration?.isActive || false,
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      mode: "ai",
      illustrationData: formData as IllustrationGenerateSchema,
    });
    onSuccess?.();
  };

  const updateFormData = (updates: Partial<IllustrationGenerateSchema>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SongIdField
        songId={formData.songId || ""}
        onSongIdChange={(value) => updateFormData({ songId: value })}
        mode="ai"
      />

      <div className="space-y-2">
        <Label>Prompt Version</Label>
        <Select
          value={formData.promptVersion}
          onValueChange={(value) =>
            updateFormData({ promptVersion: value as "v1" | "v2" })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a prompt version" />
          </SelectTrigger>
          <SelectContent>
            {dropdownOptions.promptVersions.data.map(
              (option: { value: string; label: string }) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Summary Model</Label>
          <Select
            value={formData.summaryModel}
            onValueChange={(value) =>
              updateFormData({ summaryModel: value as "gpt-4o" | "gpt-4o-mini" })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select summary model" />
            </SelectTrigger>
            <SelectContent>
              {dropdownOptions.summaryModels.data.map(
                (option: { value: string; label: string }) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        <ImageModelSelect
          value={formData.imageModel || ""}
          onChange={(value) =>
            updateFormData({ imageModel: value as "FLUX.1-dev" })
          }
          options={dropdownOptions.imageModels.data}
        />
      </div>

      <ActiveSwitch
        isActive={formData.setAsActive || false}
        onActiveChange={(checked) => updateFormData({ setAsActive: checked })}
        mode="ai"
      />

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Generating..." : "Generate with AI"}
      </Button>
    </form>
  );
}
