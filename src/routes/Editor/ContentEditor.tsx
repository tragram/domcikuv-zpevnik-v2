import { Textarea } from "@/components/ui/textarea";
import React, { useEffect, useRef } from 'react';
import './Editor.css';

// Add a new CSS rule to make the textarea adjust to its content
const textareaAutoSizeStyles = `
@media (max-width: 810px) {
  .auto-resize-textarea {
    overflow-y: hidden;
  }
}
`;

import TemplateButton from './components/TemplateButton';

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
  const insertTemplate = (templateKey: string) => {
    if (!textareaRef.current || !templates[templateKey]) return;

    const template = templates[templateKey];
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

  // Various template options
  const templates = {
    chorus: {
      name: "Chorus",
      template: "{start_of_chorus}\n\n{end_of_chorus}\n\n",
      cursorOffset: 1 // Position after first \n\n
    },
    verse: {
      name: "Verse",
      template: "{start_of_verse}\n\n{end_of_verse}\n\n",
      cursorOffset: 1
    },
    bridge: {
      name: "Bridge",
      template: "{start_of_bridge}\n\n{end_of_bridge}\n\n",
      cursorOffset: 1
    },
    comment: {
      name: "Comment",
      template: "{Comment: }\n",
      cursorOffset: -2
    },
    chords: {
      name: "Chord",
      template: "[]",
      cursorOffset: -1
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className='w-full flex flex-wrap gap-2 p-2 bg-gray-100'>
        <TemplateButton templateKey="chorus" text="Chorus" onInsert={insertTemplate} />
        <TemplateButton templateKey="verse" text="Verse" onInsert={insertTemplate} />
        <TemplateButton templateKey="bridge" text="Bridge" onInsert={insertTemplate} />
        <TemplateButton templateKey="comment" text="Comment" onInsert={insertTemplate} />
        <TemplateButton templateKey="chords" text="Chord" onInsert={insertTemplate} />
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