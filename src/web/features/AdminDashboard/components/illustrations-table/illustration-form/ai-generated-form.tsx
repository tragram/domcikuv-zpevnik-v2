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
import { IllustrationGenerateSchema } from "src/worker/helpers/illustration-helpers";
import {
  SummaryPromptVersion,
  AvailableSummaryModel,
  AvailableImageModel,
} from "src/worker/helpers/image-generator";
import {
  useIllustrationOptions,
  useSongPrompts,
} from "~/features/AdminDashboard/adminHooks";
import { useRouteContext } from "@tanstack/react-router";
import { defaultPromptId } from "~/types/songData";
interface AIGeneratedFormProps {
  illustration: {
    songId?: string;
    summaryPromptVersion?: SummaryPromptVersion;
    summaryModel?: AvailableSummaryModel;
    imageModel?: AvailableImageModel;
    isActive?: boolean;
  } | null;
  onSave: (data: IllustrationSubmitData) => void;
  isLoading?: boolean;
  onSuccess?: () => void;
}

function AIGeneratedForm({
  illustration,
  onSave,
  isLoading,
  onSuccess,
}: AIGeneratedFormProps) {
  const options = useIllustrationOptions();
  const adminApi = useRouteContext({ from: "/admin" }).api.admin;
  const { songPrompts } = useSongPrompts(adminApi, illustration?.songId);

  const [formData, setFormData] = useState({
    songId: illustration?.songId || "",
    promptVersion:
      illustration?.summaryPromptVersion || options.promptVersions.default,
    summaryModel: illustration?.summaryModel || options.summaryModels.default,
    imageModel: illustration?.imageModel || options.imageModels.default,
    setAsActive: illustration?.isActive || false,
  });

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
            updateFormData({ promptVersion: value as SummaryPromptVersion })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a prompt version" />
          </SelectTrigger>
          <SelectContent>
            {options.promptVersions.data.map(
              (option: { value: string; label: string }) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ),
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
              updateFormData({
                summaryModel: value as AvailableSummaryModel,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select summary model" />
            </SelectTrigger>
            <SelectContent>
              {options.summaryModels.data.map(
                (option: { value: string; label: string }) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>

        <ImageModelSelect
          value={formData.imageModel || ""}
          onChange={(value) =>
            updateFormData({ imageModel: value as AvailableImageModel })
          }
          options={options.imageModels.data}
        />
      </div>

      <ActiveSwitch
        isActive={formData.setAsActive || false}
        onActiveChange={(checked) => updateFormData({ setAsActive: checked })}
        mode="ai"
      />
      {illustration?.songId && (
        <p>
          {songPrompts
            .map((p) => p.id)
            .includes(
              defaultPromptId(
                illustration?.songId,
                formData.summaryModel,
                formData.promptVersion,
              ),
            )
            ? "Prompt exists"
            : "Prompt will be generated"}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Generating..." : "Generate with AI"}
      </Button>
    </form>
  );
}

export default AIGeneratedForm;
