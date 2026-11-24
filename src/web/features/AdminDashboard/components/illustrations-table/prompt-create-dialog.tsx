import { useRouteContext } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  useCreatePrompt,
  useGeneratePrompt,
  useIllustrationOptions,
} from "../../../../services/admin-hooks";
import useLocalStorageState from "use-local-storage-state";
import { ApiException } from "~/services/api-service";
import {
  AvailableSummaryModel,
  SummaryPromptVersion,
} from "src/lib/contracts/image-generation";
import type { IllustrationPromptApi } from "src/worker/api/api-types";

type PromptTab = "ai" | "manual" | "saved";

export function PromptCreateDialog({
  songId,
  songPrompts,
}: {
  songId: string;
  songPrompts: IllustrationPromptApi[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [preferredTab, setActiveTab] = useLocalStorageState<PromptTab>(
    "admin-prompt-form-activeTab",
    { defaultValue: "manual" },
  );
  const activeTab = preferredTab === "saved" && !songPrompts.length ? "ai" : preferredTab;

  const adminApi = useRouteContext({ from: "/admin" }).api.admin;
  const options = useIllustrationOptions(adminApi);

  // Manual State
  const [text, setText] = useState("");
  const [manualSummaryModel, setManualSummaryModel] = useState("manual");
  const [manualPromptVersion, setManualPromptVersion] =
    useState<SummaryPromptVersion>(options.promptVersions.default);

  // AI State
  const [selectedSummaryModel, setAiSummaryModel] = useState<AvailableSummaryModel>();
  const aiSummaryModel = selectedSummaryModel ?? options.summaryModels.default;
  const [aiPromptVersion, setAiPromptVersion] = useState<SummaryPromptVersion>(
    options.promptVersions.default,
  );

  const handleAiSummaryModelChange = (model: AvailableSummaryModel) => {
    setAiSummaryModel(model);
    if (!songPrompts.some((prompt) => prompt.summaryModel === model)) {
      setAiPromptVersion(options.promptVersions.default);
    }
  };

  const createMutation = useCreatePrompt(adminApi);
  const generateMutation = useGeneratePrompt(adminApi);

  const handleManualSave = async () => {
    try {
      await createMutation.mutateAsync({
        songId,
        summaryModel: manualSummaryModel,
        summaryPromptVersion: manualPromptVersion,
        text,
      });
      toast.success("Prompt created successfully");
      resetAndClose();
    } catch (err) {
      if (err instanceof ApiException)
        toast.error(err.message || "Failed to create prompt");
      else toast.error("Failed to create prompt");
    }
  };

  const handleAIGenerate = async () => {
    try {
      await generateMutation.mutateAsync({
        songId,
        summaryModel: aiSummaryModel,
        summaryPromptVersion: aiPromptVersion,
      });
      toast.success("Prompt generated successfully");
      resetAndClose();
    } catch (err) {
      if (err instanceof ApiException)
        toast.error(err.message || "Failed to create prompt");
      else toast.error("Failed to create prompt");
    }
  };

  const resetAndClose = () => {
    setIsOpen(false);
    setText("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs">
          <Plus className="h-3 w-3 mr-1" /> Add Prompt
        </Button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>Song Prompts</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as PromptTab)}
          className="w-full mt-4"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ai">Generate with AI</TabsTrigger>
            <TabsTrigger value="manual">Write manually</TabsTrigger>
            <TabsTrigger value="saved" disabled={!songPrompts.length}>Saved prompts</TabsTrigger>
          </TabsList>

          <TabsContent value="saved" className="space-y-4 py-4">
            <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">
              {songPrompts.map((prompt) => (
                <li key={prompt.id} className="px-3 py-2 text-sm wrap-break-word">
                  {prompt.summaryModel} · {prompt.summaryPromptVersion}
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button variant="outline" onClick={resetAndClose}>Close</Button>
            </DialogFooter>
          </TabsContent>

          {/* AI GENERATED TAB */}
          <TabsContent value="ai" className="space-y-4 py-4">
            <fieldset className="grid min-w-0 grid-cols-2 gap-4 rounded-lg border bg-muted/20 p-3">
              <legend className="px-1 text-sm font-medium">New prompt settings</legend>
              <div className="space-y-2">
                <Label>Summary Model</Label>
                <Select
                  value={aiSummaryModel}
                  onValueChange={handleAiSummaryModelChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.summaryModels.data.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prompt Version</Label>
                <Select
                  value={aiPromptVersion}
                  onValueChange={(promptVersion: SummaryPromptVersion) =>
                    setAiPromptVersion(promptVersion)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.promptVersions.data.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </fieldset>
            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={resetAndClose}>
                Cancel
              </Button>
              <Button
                onClick={handleAIGenerate}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending
                  ? "Generating..."
                  : "Generate Prompt"}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* MANUAL TAB */}
          <TabsContent value="manual" className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Summary Model</Label>
                <Input
                  value={manualSummaryModel}
                  onChange={(e) => setManualSummaryModel(e.target.value)}
                  placeholder="e.g. manual, gpt-4o, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Prompt Version</Label>
                <Select
                  value={manualPromptVersion}
                  onValueChange={(version: SummaryPromptVersion) =>
                    setManualPromptVersion(version)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.promptVersions.data.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Prompt Text</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[150px] font-mono text-sm"
                placeholder="Enter prompt text here..."
              />
            </div>
            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={resetAndClose}>
                Cancel
              </Button>
              <Button
                onClick={handleManualSave}
                disabled={createMutation.isPending || !text.trim()}
              >
                {createMutation.isPending ? "Saving..." : "Save Prompt"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
