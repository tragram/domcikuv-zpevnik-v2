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
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Textarea } from "~/components/ui/textarea";
import { useSongPrompts } from "~/services/adminHooks";
import { useRouteContext } from "@tanstack/react-router";
import { cn } from "~/lib/utils";

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

interface PromptSelectorProps {
  songId: string;
  selectedPromptId: string;
  onPromptSelect: (id: string) => void;
  promptMode: "existing" | "new";
  onModeChange: (mode: "existing" | "new") => void;
  newPromptData: { text: string; model: string; version: string };
  onNewPromptChange: (data: any) => void;
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
    <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
      <Label className="text-base font-semibold">Illustration Prompt</Label>
      <RadioGroup
        value={promptMode}
        onValueChange={onModeChange}
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
              Use an existing prompt ({songPrompts.length})
            </Label>
          </div>
          {promptMode === "existing" && (
            <div className="pl-6 space-y-2">
              <Select value={selectedPromptId} onValueChange={onPromptSelect}>
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
            <Label htmlFor="mode-new">Create a new prompt</Label>
          </div>
          {promptMode === "new" && (
            <div className="pl-6 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Model Label</Label>
                  <Input
                    value={newPromptData.model}
                    onChange={(e) =>
                      onNewPromptChange({
                        ...newPromptData,
                        model: e.target.value,
                      })
                    }
                    className="bg-background h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Version Label</Label>
                  <Input
                    value={newPromptData.version}
                    onChange={(e) =>
                      onNewPromptChange({
                        ...newPromptData,
                        version: e.target.value,
                      })
                    }
                    className="bg-background h-8"
                  />
                </div>
              </div>
              <Textarea
                placeholder="Enter prompt text..."
                value={newPromptData.text}
                onChange={(e) =>
                  onNewPromptChange({ ...newPromptData, text: e.target.value })
                }
                className="min-h-[100px] bg-background"
                required={promptMode === "new"}
              />
            </div>
          )}
        </div>
      </RadioGroup>
    </div>
  );
}
