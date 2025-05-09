import React, { useState } from 'react';
import { Textarea } from "@/components/ui/textarea"
import SongHeading from '../components/SongHeading';
import { SongData } from '@/types/types';
import { LayoutSettings } from '../hooks/viewSettingsStore';
import { renderSong } from '../utils/songRendering';
import '../SongView.css'
import { Input } from '@/components/ui/input';
import { Label } from '@radix-ui/react-label';
type EditorProps = {
};

const HeaderField: React.FC<{ label: string; onChange: (value: string) => void; placeholder?: string }> = ({ label, onChange, placeholder }) => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
        <Label>{label}</Label>
        <Input placeholder={placeholder || label} onChange={(e) => { onChange(e.target.value) }} />
    </div>
);

const Editor: React.FC<EditorProps> = ({ }) => {
    const [editorContent, setEditorContent] = useState("");
    const [renderedResult, setRenderedResult] = useState("");
    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");
    const [capo, setCapo] = useState("");
    // const [range, setRange] = useState("");

    const songData = { title: title, artist: artist, capo: capo, range: "" } as SongData;
    const layout = {} as LayoutSettings;
    const transposeSteps = 0;
    const renderResult = (e) => {
        const newContent = e.target.value;
        setEditorContent(newContent);
        const result = renderSong(
            { ...songData, content: newContent },
            transposeSteps,
            true
        )
        setRenderedResult(result);
    }

    return (
        <div className='flex h-screen w-screen'>
            <div className='flex flex-col basis-[20%] p-8 gap-4'>
                <h1 className='text-primary text-center text-3xl font-extrabold'>
                    Header
                </h1>
                <HeaderField label="Artist" onChange={setArtist} placeholder="František Omáčka" />
                <HeaderField label="Title" onChange={setTitle} placeholder="Apassionata v F" />
                <HeaderField label="Capo" onChange={setCapo} placeholder="0" />
            </div>
            <div className='flex flex-col basis-[40%] p-8 gap-4'>
                <h1 className='text-primary text-center text-3xl font-extrabold'>
                    Editor
                </h1>
                <Textarea className='h-full w-full px-4 py-2 resize-none' onInput={e => renderResult(e)} value={editorContent} />
            </div>
            <div className='flex flex-col basis-[40%] p-8 gap-4 max-h-full'>
                <h1 className='text-primary text-center text-3xl font-extrabold'>
                    Result
                </h1>
                <div className='overflow-y-scroll '>

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