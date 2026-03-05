import {
  IllustrationCreateSchema,
  IllustrationGenerateSchema,
} from "src/worker/helpers/illustration-helpers";
import {
  AvailableImageModel,
  AvailableSummaryModel,
  SummaryPromptVersion,
} from "src/worker/helpers/image-generator";
import useLocalStorageState from "use-local-storage-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import AIGeneratedForm from "./ai-generated-form";
import { ManualForm } from "./manual-form";
import { useRouteContext } from "@tanstack/react-router";
import { useSongPrompts } from "~/services/admin-hooks";

export interface IllustrationFormData {
  songId: string;
  summaryPromptVersion?: SummaryPromptVersion;
  summaryModel?: AvailableSummaryModel;
  imageModel?: AvailableImageModel;
  isActive?: boolean;
  promptId?: string;
}

export type IllustrationSubmitData =
  | {
      mode: "manual";
      illustrationData: IllustrationCreateSchema;
    }
  | {
      mode: "ai";
      illustrationData: IllustrationGenerateSchema;
    };

export interface IllustrationFormProps {
  illustration: IllustrationFormData;
  activePromptId?: string;
  onSave: (data: IllustrationSubmitData) => void;
  isLoading?: boolean;
  onSuccess?: () => void;
}

export function IllustrationForm({
  illustration,
  activePromptId,
  onSave,
  isLoading,
  onSuccess = () => {},
}: IllustrationFormProps) {
  const [activeTab, setActiveTab] = useLocalStorageState<"ai" | "manual">(
    "admin-illustration-form-activeTab",
    { defaultValue: "ai" },
  );
  const adminApi = useRouteContext({ from: "/admin" }).api.admin;
  const { songPrompts } = useSongPrompts(adminApi, illustration.songId);
  // TODO: what gets shown on edit - make sure it's the right thing
  return (
    <div className="max-w-full flex flex-col p-6 overflow-auto">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "ai" | "manual")}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ai">AI Generated</TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
        </TabsList>
        <TabsContent value="ai" className="space-y-4 mt-6">
          <AIGeneratedForm
            illustration={illustration}
            activePromptId={activePromptId}
            songPrompts={songPrompts}
            onSave={onSave}
            isLoading={isLoading}
            onSuccess={onSuccess}
          />
        </TabsContent>
        <TabsContent value="manual" className="space-y-4 mt-6">
          <ManualForm
            illustration={illustration}
            activePromptId={activePromptId}
            songPrompts={songPrompts}
            onSave={onSave}
            isLoading={isLoading}
            onSuccess={onSuccess}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
