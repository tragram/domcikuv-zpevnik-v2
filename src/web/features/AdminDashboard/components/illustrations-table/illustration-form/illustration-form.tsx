import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  SummaryPromptVersion,
  AvailableSummaryModel,
  AvailableImageModel,
} from "~/../worker/api/admin/image-generator";
import {
  IllustrationCreateSchema,
  IllustrationGenerateSchema,
} from "src/worker/api/admin/illustrations";
import { AIGeneratedForm } from "./ai-generated-form";
import { ManualForm } from "./manual-form";

interface IllustrationFormData {
  songId?: string;
  summaryPromptVersion?: string;
  summaryModel?: string;
  imageModel?: string;
  imageURL?: string;
  thumbnailURL?: string;
  isActive?: boolean;
}

interface DropdownOptions {
  promptVersions: {
    data: Array<{
      value: SummaryPromptVersion;
      label: string;
    }>;
    default: SummaryPromptVersion;
  };
  summaryModels: {
    data: Array<{
      value: AvailableSummaryModel;
      label: string;
    }>;
    default: AvailableSummaryModel;
  };
  imageModels: {
    data: Array<{
      value: AvailableImageModel;
      label: string;
    }>;
    default: AvailableImageModel;
  };
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
  onSave: (data: IllustrationSubmitData) => void;
  isLoading?: boolean;
  dropdownOptions: DropdownOptions;
  manualOnly?: boolean;
}

export function IllustrationForm({
  illustration,
  onSave,
  isLoading,
  dropdownOptions,
  manualOnly = false,
}: IllustrationFormProps) {
  const [activeTab, setActiveTab] = useState<"ai" | "manual">(
    manualOnly ? "manual" : "ai"
  );

  if (manualOnly) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <ManualForm
          illustration={illustration}
          onSave={onSave}
          isLoading={isLoading}
          dropdownOptions={dropdownOptions}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
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
            dropdownOptions={dropdownOptions}
          />
        </TabsContent>
        <TabsContent value="manual" className="space-y-4 mt-6">
          <ManualForm
            illustration={illustration}
            onSave={onSave}
            isLoading={isLoading}
            dropdownOptions={dropdownOptions}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}