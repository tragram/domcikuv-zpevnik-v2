import type { EditorState } from "~/types/types";
import MetadataField from "./MetadataField";

export type VersionDetails = Pick<EditorState, "label" | "description">;

export function VersionDetailsFields({ details, defaults, errors, onChange }: {
  details: VersionDetails;
  defaults: VersionDetails;
  errors: Partial<Record<keyof VersionDetails, string>>;
  onChange: (field: keyof VersionDetails, value: string) => void;
}) {
  return (
    <>
      <MetadataField
        label="Version name"
        value={details.label ?? ""}
        onChange={(value) => onChange("label", value)}
        modified={defaults.label !== details.label}
        error={errors.label}
        description={`${20 - [...(details.label ?? "")].length} characters remaining`}
      />
      <MetadataField
        label="Version description"
        value={details.description ?? ""}
        onChange={(value) => onChange("description", value)}
        modified={defaults.description !== details.description}
        error={errors.description}
        description={`${120 - [...(details.description ?? "")].length} characters remaining`}
      />
    </>
  );
}
