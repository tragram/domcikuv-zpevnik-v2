import { useRouteContext } from "@tanstack/react-router";
import { History } from "lucide-react";
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
  ExistingPromptSelect,
  IllustrationPromptOptions,
  type PromptMode,
  SongIdField,
} from "./shared-form-fields";

interface AIGeneratedFormProps extends IllustrationFormProps {
  songPrompts: IllustrationPromptApi[];
}

/**
 * A candidate model/version is only usable if the select offers it — a removed
 * one would render as an empty select and submit an invalid value.
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

  const [selectedMode, setSelectedMode] = useState<PromptMode>();
  const [selectedPromptId, setSelectedPromptId] = useState<string>();
  const [overrides, setOverrides] = useState<Partial<IllustrationGenerateSchema>>({});
  const promptMode = songPrompts.length ? selectedMode ?? "existing" : "new";
  const savedPrompt =
    songPrompts.find((prompt) => prompt.id === (selectedPromptId ?? illustration.promptId)) ??
    songPrompts.find((prompt) =>
      prompt.summaryModel === illustration.summaryModel &&
      prompt.summaryPromptVersion === illustration.summaryPromptVersion,
    ) ??
    songPrompts.find((prompt) => prompt.id === activePromptId) ??
    songPrompts[0];

  const newSummaryModel = overrides.summaryModel ?? pickValid(
    illustration.summaryModel,
    options.summaryModels.data,
    options.summaryModels.default,
  );
  const savedVersions = new Set(songPrompts
    .filter((prompt) => prompt.summaryModel === newSummaryModel)
    .map((prompt) => prompt.summaryPromptVersion));
  const availableVersions = options.promptVersions.data.filter(
    ({ value }) => !savedVersions.has(value),
  );
  const latestAvailableVersion = availableVersions[0]?.value ?? options.promptVersions.default;
  const newPromptVersion = pickValid<string>(
    overrides.promptVersion ?? (overrides.summaryModel ? undefined : illustration.summaryPromptVersion),
    availableVersions,
    latestAvailableVersion,
  );

  const usingExistingPrompt = promptMode === "existing";
  const formData = {
    songId: overrides.songId ?? illustration.songId,
    summaryModel: usingExistingPrompt && savedPrompt ? savedPrompt.summaryModel : newSummaryModel,
    promptVersion: usingExistingPrompt && savedPrompt ? savedPrompt.summaryPromptVersion : newPromptVersion,
    imageModel: pickValid<AvailableImageModel>(
      overrides.imageModel ?? illustration.imageModel,
      options.imageModels.data,
      options.imageModels.default,
    ),
    setAsActive: overrides.setAsActive ?? illustration.isActive ?? false,
  };

  const illustrationExists = useMemo(() => {
    if (!usingExistingPrompt) return false;
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
    usingExistingPrompt,
  ]);

  const canUsePrompt = usingExistingPrompt ? Boolean(savedPrompt) : availableVersions.length > 0;
  const canSubmit = !isLoading && !illustrationExists && Boolean(formData.songId) && canUsePrompt;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
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

      <IllustrationPromptOptions
        promptCount={songPrompts.length}
        value={promptMode}
        onValueChange={setSelectedMode}
        newLabel="Generate a new prompt"
      >
        {usingExistingPrompt ? (
          <ExistingPromptSelect
            prompts={songPrompts}
            value={savedPrompt?.id}
            onValueChange={setSelectedPromptId}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Summary Model</Label>
                <Select
                  value={newSummaryModel}
                  onValueChange={(summaryModel) =>
                    updateFormData({ summaryModel, promptVersion: undefined })
                  }
                >
                  <SelectTrigger className="w-full" aria-label="Summary model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.summaryModels.data.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Prompt Version</Label>
                <Select
                  value={availableVersions.length ? newPromptVersion : ""}
                  disabled={availableVersions.length === 0}
                  onValueChange={(promptVersion) => updateFormData({ promptVersion })}
                >
                  <SelectTrigger className="w-full" aria-label="Prompt version">
                    <SelectValue placeholder="All versions saved" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.promptVersions.data.map(({ value, label }) => (
                      <SelectItem key={value} value={value} disabled={savedVersions.has(value)}>
                        {label}{savedVersions.has(value) && " · saved"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {availableVersions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Choose another model or use a saved prompt.
              </p>
            )}
          </>
        )}
      </IllustrationPromptOptions>

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
          disabled={!canSubmit}
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
