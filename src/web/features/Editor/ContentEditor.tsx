import { Textarea } from "~/components/ui/textarea";
import React, { useEffect, useRef } from "react";
import "./Editor.css";
import {
  SnippetButtonSection,
  SnippetButton,
  snippets,
} from "./components/Snippets";
import { cn, tailwindBreakpoint } from "~/lib/utils";

const textareaAutoSizeStyles = `
@media (max-width: 810px) {
  .auto-resize-textarea {
    overflow-y: hidden;
  }
}
`;

interface ContentEditorProps {
  editorContent: string;
  setEditorContent: (content: string) => void;
}

const ContentEditor: React.FC<ContentEditorProps> = ({
  editorContent,
  setEditorContent,
}) => {
  // Reference to the textarea element
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Adjust textarea height when content changes (for mobile)
    if (textareaRef.current && window.innerWidth < tailwindBreakpoint("md")) {
      const textarea = textareaRef.current;
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [editorContent]);

  // Add the stylesheet to the document head and set up resize listener
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = textareaAutoSizeStyles;
    document.head.appendChild(style);

    // Function to adjust textarea height based on screen size
    const adjustTextareaHeight = () => {
      if (!textareaRef.current) return;

      const textarea = textareaRef.current;
      if (window.innerWidth < tailwindBreakpoint("md")) {
        // Mobile: Auto-height based on content
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
      } else {
        // Desktop: Reset to use container height
        textarea.style.height = "";
      }
    };

    // Adjust height on window resize
    window.addEventListener("resize", adjustTextareaHeight);

    // Initial adjustment
    adjustTextareaHeight();

    return () => {
      document.head.removeChild(style);
      window.removeEventListener("resize", adjustTextareaHeight);
    };
  }, []);

  const onEditorChange = (e) => {
    const newContent = e.target.value;
    setEditorContent(newContent);
  };

  // Insert template at current cursor position with undo/redo support
  const insertSnippet = (snippetKey: string) => {
    if (!textareaRef.current || !snippets[snippetKey]) return;

    const snippet = snippets[snippetKey];
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Get selected text
    const selectedText = editorContent.substring(start, end);

    // Focus the textarea to make it the active element
    textarea.focus();

    // Determine what text to insert and where the cursor should end up
    const textToInsert = snippet.template(selectedText ?? "");
    const finalCursorPos = selectedText
      ? start + textToInsert.length
      : start + snippet.cursorOffset;

    // Use the Document execCommand API for undo support
    // This modifies the document in a way that registers with the browser's undo stack
    try {
      // For modern browsers, try using InputEvent
      if (typeof InputEvent === "function") {
        // First delete any selected text (this will be undoable)
        if (start !== end) {
          document.execCommand("delete", false);
        }

        // Then insert our text (this will be undoable)
        document.execCommand("insertText", false, textToInsert);

        // Position cursor where needed
        textarea.setSelectionRange(finalCursorPos, finalCursorPos);
      } else {
        // Fallback for older browsers - this won't be undoable as a single action
        // but we ensure content is updated in state
        const newContent =
          editorContent.substring(0, start) +
          textToInsert +
          editorContent.substring(end);

        setEditorContent(newContent);

        // Position cursor
        setTimeout(() => {
          textarea.setSelectionRange(finalCursorPos, finalCursorPos);
        }, 0);
      }
    } catch (e) {
      console.error("Error using execCommand for undo-friendly insertion:", e);

      // Fallback method if execCommand fails
      const newContent =
        editorContent.substring(0, start) +
        textToInsert +
        editorContent.substring(end);

      setEditorContent(newContent);

      // Position cursor
      setTimeout(() => {
        textarea.setSelectionRange(finalCursorPos, finalCursorPos);
      }, 0);
    }
  };
  return (
    <div className="flex flex-col h-full">
      <div className="w-full flex flex-wrap gap-1 border-b-4 md:border-b-8 border-primary mt-1 md:mt-0">
        <SnippetButtonSection label="Environments">
          <SnippetButton snippetKey="verse_env" onInsert={insertSnippet} />
          <SnippetButton snippetKey="bridge_env" onInsert={insertSnippet} />
          <SnippetButton snippetKey="chorus_env" onInsert={insertSnippet} />
        </SnippetButtonSection>
        <SnippetButtonSection label="Recalls">
          <SnippetButton snippetKey="verse_recall" onInsert={insertSnippet} />
          <SnippetButton snippetKey="bridge_recall" onInsert={insertSnippet} />
          <SnippetButton snippetKey="chorus_recall" onInsert={insertSnippet} />
        </SnippetButtonSection>
        <SnippetButtonSection label="Variants">
          <SnippetButton
            snippetKey="prepend_content"
            onInsert={insertSnippet}
          />
          <SnippetButton
            snippetKey="replace_first_line"
            onInsert={insertSnippet}
          />
          <SnippetButton
            snippetKey="replace_last_line"
            onInsert={insertSnippet}
          />
          <SnippetButton snippetKey="append_content" onInsert={insertSnippet} />
        </SnippetButtonSection>
        <SnippetButtonSection label="Misc">
          <SnippetButton snippetKey="comment" onInsert={insertSnippet} />
          <SnippetButton snippetKey="chords" onInsert={insertSnippet} />
        </SnippetButtonSection>
      </div>
      <Textarea
        ref={textareaRef}
        className={cn(
          "resize-none main-container !rounded-t-none outline-none focus-visible:bg-primary/10 h-auto md:h-full flex-grow auto-resize-textarea hyphens-auto !rounded-b-none border-none"
        )}
        onInput={(e) => {
          onEditorChange(e);
        }}
        value={editorContent}
      />
    </div>
  );
};

export default ContentEditor;
