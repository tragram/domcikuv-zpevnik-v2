import { Textarea } from "@/components/ui/textarea";
import React, { useEffect, useRef } from 'react';
import './Editor.css';
import { SnippetButtonSection, SnippetButton ,snippets } from "./components/Snippets";

// Add a new CSS rule to make the textarea adjust to its content
const textareaAutoSizeStyles = `
@media (max-width: 810px) {
  .auto-resize-textarea {
    overflow-y: hidden;
  }
}
`;

type ContentEditorProps = {
  editorContent;
  setEditorContent;
};

const MD_WIDTH = 810;


const ContentEditor: React.FC<ContentEditorProps> = ({ editorContent, setEditorContent }) => {
  // Reference to the textarea element
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Adjust textarea height when content changes (for mobile)
    if (textareaRef.current && window.innerWidth < MD_WIDTH) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [editorContent])

  // Add the stylesheet to the document head and set up resize listener
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = textareaAutoSizeStyles;
    document.head.appendChild(style);

    // Function to adjust textarea height based on screen size
    const adjustTextareaHeight = () => {
      if (!textareaRef.current) return;

      const textarea = textareaRef.current;

      if (window.innerWidth < 810) {
        // TODO: this should actually refernce the Tailwind variable
        // Mobile: Auto-height based on content
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      } else {
        // Desktop: Reset to use container height
        textarea.style.height = '';
      }
    };

    // Adjust height on window resize
    window.addEventListener('resize', adjustTextareaHeight);

    // Initial adjustment
    adjustTextareaHeight();

    return () => {
      document.head.removeChild(style);
      window.removeEventListener('resize', adjustTextareaHeight);
    };
  }, []);

  const onEditorChange = (e) => {
    const newContent = e.target.value;
    setEditorContent(newContent);
  }

  // Insert template at current cursor position
  const insertSnippet = (snippetKey: string) => {
    if (!textareaRef.current || !snippets[snippetKey]) return;

    const template = snippets[snippetKey];
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const scrollTop = textarea.scrollTop; // Store current scroll position

    // Get selected text
    const selectedText = editorContent.substring(start, end);

    // If there's selected text and the template has placeholder points (with \n\n),
    // we'll place the selected text at that position
    let newContent;
    let newCursorPos;

    if (selectedText && template.template.includes("\n\n")) {
      // Place selected text between the tags
      const parts = template.template.split("\n\n");
      newContent =
        editorContent.substring(0, start) +
        parts[0] + "\n" + selectedText + "\n" + parts[1] +
        editorContent.substring(end);

      // Position cursor at the end of the inserted text
      newCursorPos = start + parts[0].length + 1 + selectedText.length;
    } else {
      // Normal insertion
      newContent =
        editorContent.substring(0, start) +
        template.template +
        editorContent.substring(end);

      // Calculate cursor position
      const basePos = start + template.template.indexOf("\n\n");
      newCursorPos = template.cursorOffset >= 0
        ? basePos + template.cursorOffset
        : start + template.template.length + template.cursorOffset;
    }

    // Update the content
    setEditorContent(newContent);

    // Set the cursor position and restore scroll position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.scrollTop = scrollTop; // Restore the scroll position
    }, 0);
  };


  return (
    <div className="flex flex-col h-full">
      <div className='w-full flex flex-wrap gap-1 border-primary border-4 border-b-0 rounded-t-md'>
        <SnippetButtonSection label="Environments">
          <SnippetButton snippetKey="verse_env" onInsert={insertSnippet}/>
          <SnippetButton snippetKey="bridge_env" onInsert={insertSnippet} />
          <SnippetButton snippetKey="chorus_env" onInsert={insertSnippet} />
        </SnippetButtonSection>
        <SnippetButtonSection label="Recalls">
          <SnippetButton snippetKey="verse_recall" onInsert={insertSnippet} />
          <SnippetButton snippetKey="bridge_recall" onInsert={insertSnippet} />
          <SnippetButton snippetKey="chorus_recall" onInsert={insertSnippet} />
        </SnippetButtonSection>
        <SnippetButtonSection label="Variants">
          <SnippetButton snippetKey="prepend_content" onInsert={insertSnippet} />
          <SnippetButton snippetKey="replace_first_line" onInsert={insertSnippet} />
          <SnippetButton snippetKey="replace_last_line" onInsert={insertSnippet} />
          <SnippetButton snippetKey="append_content" onInsert={insertSnippet} />
        </SnippetButtonSection>
        <SnippetButtonSection label="Misc">
          <SnippetButton snippetKey="comment" onInsert={insertSnippet} />
          <SnippetButton snippetKey="chords"  onInsert={insertSnippet} />
        </SnippetButtonSection>
      </div>
      <Textarea
        ref={textareaRef}
        className='resize-none main-container !rounded-t-none outline-none focus-visible:bg-primary/10 h-auto md:h-full flex-grow auto-resize-textarea hyphens-auto'
        style={{ minHeight: '300px' }}
        onInput={(e) => {
          // Adjust height on mobile
          if (window.innerWidth < MD_WIDTH) {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${target.scrollHeight}px`;
          }
          onEditorChange(e);
        }}
        value={editorContent} />
    </div>
  )
}

export default ContentEditor;