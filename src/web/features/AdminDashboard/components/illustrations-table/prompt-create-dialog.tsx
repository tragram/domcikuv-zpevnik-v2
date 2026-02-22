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
} from "../../../../services/adminHooks";
import useLocalStorageState from "use-local-storage-state";

export function PromptCreateDialog({ songId }: { songId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useLocalStorageState<"ai" | "manual">(
    "admin-prompt-form-activeTab",
    { defaultValue: "manual" },
  );

  const options = useIllustrationOptions();

  // Manual State
  const [text, setText] = useState("");
  const [manualSummaryModel, setManualSummaryModel] = useState("manual");
  const [manualPromptVersion, setManualPromptVersion] = useState(
    options.promptVersions.default,
  );

  // AI State
  const [aiSummaryModel, setAiSummaryModel] = useState(
    options.summaryModels.default,
  );
  const [aiPromptVersion, setAiPromptVersion] = useState(
    options.promptVersions.default,
  );

  const adminApi = useRouteContext({ from: "/admin" }).api.admin;
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
    } catch (err: any) {
      toast.error(err.message || "Failed to create prompt");
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
    } catch (err: any) {
      toast.error(err.message || "Failed to generate prompt");
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Prompt</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "ai" | "manual")}
          className="w-full mt-4"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai">AI Generated</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>

          {/* AI GENERATED TAB */}
          <TabsContent value="ai" className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Summary Model</Label>
                <Select
                  value={aiSummaryModel}
                  onValueChange={setAiSummaryModel}
                >
                  <SelectTrigger>
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
                  onValueChange={setAiPromptVersion}
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
                  onValueChange={setManualPromptVersion}
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
