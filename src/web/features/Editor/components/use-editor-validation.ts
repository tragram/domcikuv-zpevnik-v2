import { useMemo } from "react";
import { EditorState } from "~/types/types";
import { editorSubmitSchema } from "src/worker/api/editor";

export const useEditorValidation = (editorState: EditorState) => {
  return useMemo(() => {
    // 1. Let Zod parse the state
    const result = editorSubmitSchema.safeParse(editorState);

    const fieldErrors: Partial<Record<keyof EditorState, string>> = {};
    const globalErrors: string[] = [];

    // 2. If validation fails, map the Zod issues to our UI
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        // issue.path[0] will be 'title', 'artist', etc.
        const field = issue.path[0] as keyof EditorState;
        const message = issue.message;

        // Assign the error to the specific field for the red border
        fieldErrors[field] = message;

        // Add to global errors for the toolbar (preventing duplicates)
        if (!globalErrors.includes(message)) {
          globalErrors.push(message);
        }
      });
    }

    return {
      isValid: result.success,
      validationErrors: globalErrors,
      fieldErrors,
    };
  }, [editorState]);
};
