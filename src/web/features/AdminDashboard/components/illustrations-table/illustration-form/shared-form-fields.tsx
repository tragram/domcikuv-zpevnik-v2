import { useRouteContext } from "@tanstack/react-router";
import { useId, type ReactNode } from "react";
import type { IllustrationPromptApi } from "src/worker/api/api-types";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { RadioGroup, RadioGroupOption } from "~/components/ui/radio-group";
import { Textarea } from "~/components/ui/textarea";
import { useSongPrompts } from "~/services/admin-hooks";

interface SharedFormFieldsProps {
  songId: string;
  isActive: boolean;
  onSongIdChange: (value: string) => void;
  onActiveChange: (checked: boolean) => void;
  mode: "ai" | "manual";
}

export function SongIdField({
  songId,
  onSongIdChange,
  mode,
}: Pick<SharedFormFieldsProps, "songId" | "onSongIdChange" | "mode">) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`${mode}-songId`}>Song ID</Label>
      <Input
        id={`${mode}-songId`}
        value={songId}
        onChange={(e) => onSongIdChange(e.target.value)}
        required
        disabled
      />
    </div>
  );
}

export function ActiveSwitch({
  isActive,
  onActiveChange,
  mode,
}: Pick<SharedFormFieldsProps, "isActive" | "onActiveChange" | "mode">) {
  return (
    <div className="flex items-center space-x-2">
      <Switch
        id={`${mode}-isActive`}
        checked={isActive}
        onCheckedChange={onActiveChange}
      />
      <Label htmlFor={`${mode}-isActive`}>Active</Label>
    </div>
  );
}

interface ImageModelSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

export function ImageModelSelect({
  value,
  onChange,
  options,
}: ImageModelSelectProps) {
  return (
    <div className="space-y-2">
      <Label>Image Model</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select image model" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export interface NewPromptData {
  text: string;
  model: string;
  version: string;
}

export type PromptMode = "existing" | "new";

export function IllustrationPromptOptions({
  promptCount,
  value,
  onValueChange,
  newLabel = "Create a new prompt",
  children,
}: {
  promptCount: number;
  value: PromptMode;
  onValueChange: (value: PromptMode) => void;
  newLabel?: string;
  children: ReactNode;
}) {
  const headingId = useId();

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <p id={headingId} className="text-base font-semibold">Illustration Prompt</p>
      <RadioGroup aria-labelledby={headingId} value={value} onValueChange={onValueChange}>
        <RadioGroupOption value="existing" label={`Use an existing prompt (${promptCount})`} disabled={promptCount === 0} />
        <RadioGroupOption value="new" label={newLabel} />
      </RadioGroup>
      {children}
    </div>
  );
}

export function ExistingPromptSelect({ prompts, value, onValueChange, disabled }: {
  prompts: IllustrationPromptApi[];
  value?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select disabled={disabled} value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full min-w-0 bg-background" aria-label="Existing prompt">
        <SelectValue placeholder="Select a prompt..." />
      </SelectTrigger>
      <SelectContent className="max-w-(--radix-select-trigger-width)">
        {prompts.map((prompt) => (
          <SelectItem key={prompt.id} value={prompt.id} className="*:[span]:last:min-w-0">
            <span className="block min-w-0 truncate">
              {prompt.summaryModel} · {prompt.summaryPromptVersion}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface PromptSelectorProps {
  songId: string;
  selectedPromptId: string;
  onPromptSelect: (id: string) => void;
  promptMode: PromptMode;
  onModeChange: (mode: PromptMode) => void;
  newPromptData: NewPromptData;
  onNewPromptChange: (data: NewPromptData) => void;
}

export function PromptSelector({
  songId,
  selectedPromptId,
  onPromptSelect,
  promptMode,
  onModeChange,
  newPromptData,
  onNewPromptChange,
}: PromptSelectorProps) {
  const adminApi = useRouteContext({ from: "/admin" }).api.admin;
  const { songPrompts } = useSongPrompts(adminApi, songId);

  return (
    <IllustrationPromptOptions promptCount={songPrompts.length} value={promptMode} onValueChange={onModeChange}>
      {promptMode === "existing" ? (
        <ExistingPromptSelect prompts={songPrompts} value={selectedPromptId} onValueChange={onPromptSelect} />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Model Label</Label>
              <Input
                value={newPromptData.model}
                onChange={(e) => onNewPromptChange({ ...newPromptData, model: e.target.value })}
                className="bg-background h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Version Label</Label>
              <Input
                value={newPromptData.version}
                onChange={(e) => onNewPromptChange({ ...newPromptData, version: e.target.value })}
                className="bg-background h-8"
              />
            </div>
          </div>
          <Textarea
            placeholder="Enter prompt text..."
            value={newPromptData.text}
            onChange={(e) => onNewPromptChange({ ...newPromptData, text: e.target.value })}
            className="min-h-[100px] bg-background"
            required
          />
        </div>
      )}
    </IllustrationPromptOptions>
  );
}
