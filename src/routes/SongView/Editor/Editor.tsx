import React, { useEffect, useState, useRef } from 'react';
import { Textarea } from "@/components/ui/textarea"
import SongHeading from '../components/SongHeading';
import { SongData } from '@/types/types';
import { LayoutSettings } from '../hooks/viewSettingsStore';
import { renderSong } from '../utils/songRendering';
import '../SongView.css'
import './Editor.css'
import { Input } from '@/components/ui/input';
import { Label } from '@radix-ui/react-label';
import { Button } from "@/components/ui/button";
import useLocalStorageState from 'use-local-storage-state';

type EditorProps = {
};

const HeaderField: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder?: string }> = ({ label, value, onChange, placeholder }) => (
    <div className="grid w-full max-w-sm items-center mt-2">
        <Label>{label}</Label>
        <Input placeholder={value ? undefined : placeholder || label} value={value} onChange={(e) => { onChange(e.target.value) }} className='border-muted border-2 p-1 focus:border-primary focus:bg-primary/30' />
    </div>
);

const ContainerTitle = ({ title }) => (
    <h1 className='main-container-title'>
        {title}
    </h1>
);

interface TemplateButtonProps {
    templateKey: string;
    text: string;
    onInsert: (key: string) => void;
    className?: string;
}

const TemplateButton: React.FC<TemplateButtonProps> = ({
    templateKey,
    text,
    onInsert,
    className = "bg-primary text-white hover:bg-primary/80 text-xs py-1 px-2"
}) => (
    <Button
        onClick={() => onInsert(templateKey)}
        className={className}
    >
        {text}
    </Button>
);

const Editor: React.FC<EditorProps> = ({ }) => {
    const [editorContent, setEditorContent] = useLocalStorageState<string>("editor/editorContent", { defaultValue: "" });
    const [renderedResult, setRenderedResult] = useState("");
    const [title, setTitle] = useLocalStorageState<string>("editor/title", { defaultValue: "" });
    const [artist, setArtist] = useLocalStorageState<string>("editor/artist", { defaultValue: "" });
    const [key, setKey] = useLocalStorageState<string>("editor/key", { defaultValue: "" });
    const [dateAdded, setDateAdded] = useLocalStorageState<string>("editor/dateAdded", { defaultValue: "" });
    const [songbooks, setSongbooks] = useLocalStorageState<string>("editor/songbooks", { defaultValue: "" });
    const [startMelody, setStartMelody] = useLocalStorageState<string>("editor/startMelody", { defaultValue: "" });
    const [language, setLanguage] = useLocalStorageState<string>("editor/language", { defaultValue: "" });
    const [tempo, setTempo] = useLocalStorageState<string>("editor/tempo", { defaultValue: "" });
    const [capo, setCapo] = useLocalStorageState<string>("editor/capo", { defaultValue: "" });
    const [range, setRange] = useLocalStorageState<string>("editor/range", { defaultValue: "" });

    // Reference to the textarea element
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const songData = { title: title, artist: artist, capo: capo, range: SongData.parseRange(range) } as SongData;
    const layout = {} as LayoutSettings;
    const transposeSteps = 0;

    const onEditorChange = (e) => {
        const newContent = e.target.value;
        setEditorContent(newContent);
    }

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

    useEffect(() => {
        const result = renderSong(
            { ...songData, content: editorContent || "Nothing to show... ;-)" },
            transposeSteps,
            true
        )
        setRenderedResult(result);
    }, [editorContent, songData])

    return (
        <div className='flex h-screen w-screen'>
            <div className='flex flex-col basis-[20%] p-8 pr-4 gap-4'>
                <ContainerTitle title="Metadata" />
                <div className='main-container'>
                    <HeaderField label="Title" onChange={setTitle} placeholder="Apassionata v F" value={title} />
                    <HeaderField label="Artist" onChange={setArtist} placeholder="František Omáčka" value={artist} />
                    <HeaderField label="Key" onChange={setKey} placeholder="Dm" value={key} />
                    <HeaderField label="Date Added [YY-MM]" onChange={setDateAdded} placeholder="25-02" value={dateAdded} />
                    <HeaderField label="Songbooks" onChange={setSongbooks} placeholder='["Domčík", "Kvítek"]' value={songbooks} />
                    <HeaderField label="Start Melody" onChange={setStartMelody} placeholder="c# d e" value={startMelody} />
                    <HeaderField label="Language" onChange={setLanguage} placeholder="czech" value={language} />
                    <HeaderField label="Tempo [bpm]" onChange={setTempo} placeholder="123" value={tempo} />
                    <HeaderField label="Range" onChange={setRange} placeholder="e.g. c1-g2" value={range} />
                    <HeaderField label="Capo" onChange={setCapo} placeholder="0" value={capo} />
                </div>
            </div>
            <div className='flex flex-col basis-[40%] p-8 px-4 gap-4'>
                <ContainerTitle title="Editor" />
                <div className='w-full -mb-4 flex flex-wrap gap-2 p-2 bg-gray-100'>
                    <TemplateButton templateKey="chorus" text="Chorus" onInsert={insertTemplate} />
                    <TemplateButton templateKey="verse" text="Verse" onInsert={insertTemplate} />
                    <TemplateButton templateKey="bridge" text="Bridge" onInsert={insertTemplate} />
                    <TemplateButton templateKey="comment" text="Comment" onInsert={insertTemplate} />
                    <TemplateButton templateKey="chords" text="Chord" onInsert={insertTemplate} />
                </div>
                <Textarea
                    ref={textareaRef}
                    className='resize-none main-container !rounded-t-none outline-none focus-visible:bg-primary/10'
                    onInput={e => onEditorChange(e)}
                    value={editorContent}
                />
            </div>
            <div className='flex flex-col basis-[40%] p-8 pl-4 gap-4 max-h-full'>
                <ContainerTitle title="Result" />
                <div className='main-container'>

                    <SongHeading
                        songData={songData}
                        layoutSettings={layout}
                        transposeSteps={transposeSteps}
                    />

                    <div
                        id="song-content-wrapper"
                        dangerouslySetInnerHTML={{ __html: renderedResult }}
                    />
                </div>
            </div>
        </div>
    );
};

export default Editor;