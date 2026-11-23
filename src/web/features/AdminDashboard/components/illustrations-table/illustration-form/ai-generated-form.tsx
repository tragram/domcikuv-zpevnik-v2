import { useRouteContext } from "@tanstack/react-router";
import { CheckCircle2, History, Sparkles } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import type { IllustrationPromptApi } from "src/worker/api/api-types";
import type { IllustrationGenerateSchema } from "src/worker/api/api-types";
import type { AvailableImageModel } from "src/lib/contracts/image-generation";
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
  useIllustrationOptions,
  useIllustrationsAdmin,
} from "~/services/admin-hooks";
import type { IllustrationFormProps } from "./illustration-form";
import {
  ActiveSwitch,
  ImageModelSelect,
  SongIdField,
} from "./shared-form-fields";

interface AIGeneratedFormProps extends IllustrationFormProps {
  songPrompts: IllustrationPromptApi[];
}

/**
 * A candidate model/version is only usable if the select offers it — a removed
 * one would render as an empty select and submit an invalid value. Note the
 * options may include legacy values outside the "Available" unions.
 */
const pickValid = <T extends string>(
  candidate: string | null | undefined,
  options: { value: string }[],
  fallback: T,
): T =>
  candidate && options.some((opt) => opt.value === candidate)
    ? (candidate as T)
    : fallback;

function AIGeneratedForm({
  illustration,
  activePromptId,
  onSave,
  isLoading,
  onSuccess,
  songPrompts,
}: AIGeneratedFormProps) {
  const adminApi = useRouteContext({ from: "/admin" }).api.admin;
  const options = useIllustrationOptions(adminApi);
  const { data: allIllustrations } = useIllustrationsAdmin(adminApi);

  // Dynamically include legacy models/versions if they exist in the song's prompts
  const summaryModelOptions = useMemo(() => {
    const existing: Set<string> = new Set(
      options.summaryModels.data.map((opt) => opt.value),
    );
    const historical = Array.from(
      new Set(songPrompts.map((p) => p.summaryModel)),
    ).filter((m) => m && !existing.has(m));
    return [
      ...options.summaryModels.data,
      ...historical.map((m) => ({ value: m, label: `${m} (Legacy)` })),
    ];
  }, [options.summaryModels.data, songPrompts]);

  const promptVersionOptions = useMemo(() => {
    const existing: Set<string> = new Set(
      options.promptVersions.data.map((opt) => opt.value),
    );
    const historical = Array.from(
      new Set(songPrompts.map((p) => p.summaryPromptVersion)),
    ).filter((v) => v && !existing.has(v));
    return [
      ...options.promptVersions.data,
      ...historical.map((v) => ({ value: v, label: `${v} (Legacy)` })),
    ];
  }, [options.promptVersions.data, songPrompts]);

  // Offer reuse of the active prompt when available.
  const activePrompt = songPrompts.find((p) => p.id === activePromptId);

  const [overrides, setOverrides] = useState<Partial<IllustrationGenerateSchema>>({});
  const formData = {
    songId: illustration?.songId || "",
    promptVersion: pickValid<string>(
      illustration?.summaryPromptVersion ?? activePrompt?.summaryPromptVersion,
      promptVersionOptions,
      options.promptVersions.default,
    ),
    summaryModel: pickValid<string>(
      illustration?.summaryModel ?? activePrompt?.summaryModel,
      summaryModelOptions,
      options.summaryModels.default,
    ),
    imageModel: pickValid<AvailableImageModel>(
      illustration?.imageModel,
      options.imageModels.data,
      options.imageModels.default,
    ),
    setAsActive: illustration?.isActive || false,
    ...overrides,
  };

  const promptExists = useMemo(() => {
    if (!formData.songId) return false;
    return songPrompts.some(
      (prompt) =>
        prompt.songId === formData.songId &&
        prompt.summaryModel === formData.summaryModel &&
        prompt.summaryPromptVersion === formData.promptVersion,
    );
  }, [
    songPrompts,
    formData.songId,
    formData.summaryModel,
    formData.promptVersion,
  ]);

  const canGeneratePrompt =
    options.summaryModels.data.some(
      ({ value }) => value === formData.summaryModel,
    ) &&
    options.promptVersions.data.some(
      ({ value }) => value === formData.promptVersion,
    );
  const canUsePrompt = promptExists || canGeneratePrompt;

  const illustrationExists = useMemo(() => {
    return allIllustrations?.some((ill) => {
      const illPrompt = songPrompts.find(
        (prompt) => prompt.id === ill.promptId,
      );
      if (!illPrompt) return false;
      return (
        ill.songId === formData.songId &&
        ill.imageModel === formData.imageModel &&
        illPrompt.summaryModel === formData.summaryModel &&
        illPrompt.summaryPromptVersion === formData.promptVersion
      );
    });
  }, [
    allIllustrations,
    formData.imageModel,
    formData.promptVersion,
    formData.songId,
    formData.summaryModel,
    songPrompts,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUsePrompt) return;
    onSave({
      mode: "ai",
      illustrationData: formData,
    });
    onSuccess?.();
  };

  const updateFormData = (updates: Partial<IllustrationGenerateSchema>) => {
    setOverrides((prev) => ({ ...prev, ...updates }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <SongIdField
        songId={formData.songId || ""}
        onSongIdChange={(value) => updateFormData({ songId: value })}
        mode="ai"
      />

      {/* Prompt Configuration Group */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">
            LLM Prompt Settings
          </Label>
          {formData.songId && (
            <div
              className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                promptExists
                  ? "bg-success/10 text-success border-success/30"
                  : "bg-warning/10 text-warning border-warning/30"
              }`}
            >
              {promptExists ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  Prompt Cached
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  {canGeneratePrompt
                    ? "New Prompt Needed"
                    : "Choose a Supported Prompt"}
                </>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Model</Label>
            <Select
              value={formData.summaryModel}
              onValueChange={(summaryModel) => updateFormData({ summaryModel })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                {summaryModelOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Version</Label>
            <Select
              value={formData.promptVersion}
              onValueChange={(promptVersion) => updateFormData({ promptVersion })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Version" />
              </SelectTrigger>
              <SelectContent>
                {promptVersionOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Image Configuration Group */}
      <div className="space-y-4 border-t pt-4">
        <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground block">
          Generation Settings
        </Label>

        <ImageModelSelect
          value={formData.imageModel || ""}
          onChange={(v) =>
            updateFormData({ imageModel: v as AvailableImageModel })
          }
          options={options.imageModels.data}
        />

        <ActiveSwitch
          isActive={formData.setAsActive || false}
          onActiveChange={(checked) => updateFormData({ setAsActive: checked })}
          mode="ai"
        />
      </div>

      <div className="space-y-3">
        {illustrationExists && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-[11px] bg-muted/50 py-2 rounded-md border border-dashed">
            <History className="w-3.5 h-3.5" />
            This specific combination already exists in the gallery.
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={
            isLoading || illustrationExists || !formData.songId || !canUsePrompt
          }
        >
          {isLoading
            ? "Generating..."
            : illustrationExists
              ? "Configuration Exists"
              : "Generate Illustration"}
        </Button>
      </div>
    </form>
  );
}

export default AIGeneratedForm;
