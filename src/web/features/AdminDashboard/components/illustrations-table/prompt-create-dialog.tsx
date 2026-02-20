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
import { useCreatePrompt, useIllustrationOptions } from "../../adminHooks";

export function PromptCreateDialog({ songId }: { songId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [summaryModel, setSummaryModel] = useState("manual");

  const options = useIllustrationOptions();

  const [promptVersion, setPromptVersion] = useState(
    options.promptVersions.default,
  );

  const adminApi = useRouteContext({ from: "/admin" }).api.admin;
  const createMutation = useCreatePrompt(adminApi);

  const handleSave = async () => {
    try {
      await createMutation.mutateAsync({
        songId,
        summaryModel,
        summaryPromptVersion: promptVersion,
        text,
      });
      toast.success("Prompt created successfully");
      setIsOpen(false);
      setText("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create prompt");
    }
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
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Summary Model</Label>
              <Input
                value={summaryModel}
                onChange={(e) => setSummaryModel(e.target.value)}
                placeholder="e.g. manual, gpt-4o, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Prompt Version</Label>
              <Select value={promptVersion} onValueChange={setPromptVersion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Map over the dynamic options data here */}
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={createMutation.isPending || !text.trim()}
          >
            {createMutation.isPending ? "Saving..." : "Save Prompt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
