import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ManualForm } from "./manual-form";
import {
  IllustrationCreateSchema,
  IllustrationGenerateSchema,
} from "src/worker/helpers/illustration-helpers";
import {
  SummaryPromptVersion,
  AvailableSummaryModel,
  AvailableImageModel,
} from "src/worker/helpers/image-generator";
import { IllustrationPromptDB } from "src/lib/db/schema";
import AIGeneratedForm from "./ai-generated-form";

interface IllustrationFormData {
  songId?: string;
  summaryPromptVersion?: SummaryPromptVersion;
  summaryModel?: AvailableSummaryModel;
  imageModel?: AvailableImageModel;
  imageURL?: string;
  thumbnailURL?: string;
  isActive?: boolean;
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

interface IllustrationFormProps {
  illustration: Partial<IllustrationFormData>;
  activePromptId?: string;
  onSave: (data: IllustrationSubmitData) => void;
  isLoading?: boolean;
  manualOnly?: boolean;
  onSuccess?: () => void;
}

export function IllustrationForm({
  illustration,
  activePromptId,
  onSave,
  isLoading,
  manualOnly = false,
  onSuccess = () => {},
}: IllustrationFormProps) {
  const [activeTab, setActiveTab] = useState<"ai" | "manual">(
    manualOnly ? "manual" : "ai",
  );

  if (manualOnly) {
    return (
      <div className="max-w-full flex flex-col p-6 overflow-auto">
        <ManualForm
          illustration={illustration}
          activePromptId={activePromptId}
          onSave={onSave}
          isLoading={isLoading}
          onSuccess={onSuccess}
        />
      </div>
    );
  }

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
            onSave={onSave}
            isLoading={isLoading}
            onSuccess={onSuccess}
          />
        </TabsContent>
        <TabsContent value="manual" className="space-y-4 mt-6">
          <ManualForm
            illustration={illustration}
            activePromptId={activePromptId}
            onSave={onSave}
            isLoading={isLoading}
            onSuccess={onSuccess}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
