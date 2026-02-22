import type React from "react";
import { useState, useMemo } from "react";
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
  useIllustrationsAdmin,
} from "~/services/adminHooks";
import { useRouteContext } from "@tanstack/react-router";
import { defaultPromptId } from "~/types/songData";
import { Sparkles, CheckCircle2, History } from "lucide-react";

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
  const { data: allIllustrations } = useIllustrationsAdmin(adminApi);

  const [formData, setFormData] = useState({
    songId: illustration?.songId || "",
    promptVersion:
      illustration?.summaryPromptVersion || options.promptVersions.default,
    summaryModel:
      illustration?.summaryModel ||
      (typeof window !== "undefined"
        ? (sessionStorage.getItem("admin-ai-summaryModel") as AvailableSummaryModel)
        : null) ||
      options.summaryModels.default,
    imageModel:
      illustration?.imageModel ||
      (typeof window !== "undefined"
        ? (sessionStorage.getItem("admin-ai-imageModel") as AvailableImageModel)
        : null) ||
      options.imageModels.default,
    setAsActive: illustration?.isActive || false,
  });

  // Dynamically include legacy models/versions if they exist in the song's prompts
  const summaryModelOptions = useMemo(() => {
    const existing = new Set(options.summaryModels.data.map((opt) => opt.value));
    const historical = Array.from(new Set(songPrompts.map((p) => p.summaryModel))).filter(
      (m) => m && !existing.has(m)
    );
    return [
      ...options.summaryModels.data,
      ...historical.map((m) => ({ value: m, label: `${m} (Legacy)` })),
    ];
  }, [options.summaryModels.data, songPrompts]);

  const promptVersionOptions = useMemo(() => {
    const existing = new Set(options.promptVersions.data.map((opt) => opt.value));
    const historical = Array.from(
      new Set(songPrompts.map((p) => p.summaryPromptVersion))
    ).filter((v) => v && !existing.has(v));
    return [
      ...options.promptVersions.data,
      ...historical.map((v) => ({ value: v, label: `${v} (Legacy)` })),
    ];
  }, [options.promptVersions.data, songPrompts]);

  const promptExists = useMemo(() => {
    if (!formData.songId) return false;
    const targetId = defaultPromptId(
      formData.songId,
      formData.summaryModel,
      formData.promptVersion
    );
    return songPrompts.some((p) => p.id === targetId);
  }, [songPrompts, formData.songId, formData.summaryModel, formData.promptVersion]);

  const illustrationExists = useMemo(() => {
    return allIllustrations?.some(
      (ill) =>
        ill.songId === formData.songId &&
        ill.imageModel === formData.imageModel &&
        ill.summaryModel === formData.summaryModel &&
        ill.summaryPromptVersion === formData.promptVersion
    );
  }, [allIllustrations, formData]);

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
            <div className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
              promptExists 
                ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                : "bg-amber-50 text-amber-600 border-amber-100"
            }`}>
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
              onValueChange={(v) => updateFormData({ summaryModel: v as AvailableSummaryModel })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                {summaryModelOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Version</Label>
            <Select
              value={formData.promptVersion}
              onValueChange={(v) => updateFormData({ promptVersion: v as SummaryPromptVersion })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Version" />
              </SelectTrigger>
              <SelectContent>
                {promptVersionOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
          onChange={(v) => updateFormData({ imageModel: v as AvailableImageModel })}
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
          {isLoading ? "Generating..." : illustrationExists ? "Configuration Exists" : "Generate Illustration"}
        </Button>
      </div>
    </form>
  );
}

export default AIGeneratedForm;