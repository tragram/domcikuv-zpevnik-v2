import { useRouteContext } from "@tanstack/react-router";
import { CheckCircle2, History, Sparkles } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import type { IllustrationPromptApi } from "src/worker/api/api-types";
import type { IllustrationGenerateSchema } from "src/worker/api/api-types";
import {
  AvailableImageModel,
  AvailableSummaryModel,
  SummaryPromptVersion,
} from "src/lib/contracts/image-generation";
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
import { defaultPromptId } from "src/lib/song-ids";
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

const stored = (key: string) =>
  typeof window === "undefined" ? null : sessionStorage.getItem(key);

function AIGeneratedForm({
  illustration,
  activePromptId,
  onSave,
  isLoading,
  onSuccess,
  songPrompts,
}: AIGeneratedFormProps) {
  const adminApi = useRouteContext({ from: "/admin" }).api.admin;
  const options = useIllustrationOptions();
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

  // Preselect the settings behind the song's currently active illustration,
  // falling back to the last ones used in this session.
  const activePrompt = songPrompts.find((p) => p.id === activePromptId);

  const [formData, setFormData] = useState({
    songId: illustration?.songId || "",
    promptVersion: pickValid<SummaryPromptVersion>(
      illustration?.summaryPromptVersion ?? activePrompt?.summaryPromptVersion,
      promptVersionOptions,
      options.promptVersions.default,
    ),
    summaryModel: pickValid<AvailableSummaryModel>(
      illustration?.summaryModel ??
        activePrompt?.summaryModel ??
        stored("admin-ai-summaryModel"),
      summaryModelOptions,
      options.summaryModels.default,
    ),
    imageModel: pickValid<AvailableImageModel>(
      illustration?.imageModel ?? stored("admin-ai-imageModel"),
      options.imageModels.data,
      options.imageModels.default,
    ),
    setAsActive: illustration?.isActive || false,
  });

  const promptExists = useMemo(() => {
    if (!formData.songId) return false;
    const targetId = defaultPromptId(
      formData.songId,
      formData.summaryModel,
      formData.promptVersion,
    );
    return songPrompts.some((p) => p.id === targetId);
  }, [
    songPrompts,
    formData.songId,
    formData.summaryModel,
    formData.promptVersion,
  ]);

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
    onSave({
      mode: "ai",
      illustrationData: formData as IllustrationGenerateSchema,
    });
    onSuccess?.();
  };

  const updateFormData = (updates: Partial<IllustrationGenerateSchema>) => {
    if (updates.summaryModel) {
      sessionStorage.setItem("admin-ai-summaryModel", updates.summaryModel);
    }
    if (updates.imageModel) {
      sessionStorage.setItem("admin-ai-imageModel", updates.imageModel);
    }
    setFormData((prev) => ({ ...prev, ...updates }));
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
                  ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                  : "bg-amber-50 text-amber-600 border-amber-100"
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
                  New Prompt Needed
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
              onValueChange={(v) =>
                updateFormData({ summaryModel: v as AvailableSummaryModel })
              }
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
              onValueChange={(v) =>
                updateFormData({ promptVersion: v as SummaryPromptVersion })
              }
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
          disabled={isLoading || illustrationExists || !formData.songId}
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
