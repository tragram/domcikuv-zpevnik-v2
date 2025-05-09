import React, { useEffect, useState } from 'react';
import { Textarea } from "@/components/ui/textarea"
import SongHeading from '../components/SongHeading';
import { SongData } from '@/types/types';
import { LayoutSettings } from '../hooks/viewSettingsStore';
import { renderSong } from '../utils/songRendering';
import '../SongView.css'
import './Editor.css'
import { Input } from '@/components/ui/input';
import { Label } from '@radix-ui/react-label';
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

    const songData = { title: title, artist: artist, capo: capo, range: SongData.parseRange(range) } as SongData;
    const layout = {} as LayoutSettings;
    const transposeSteps = 0;
    const onEditorChange = (e) => {
        const newContent = e.target.value;
        setEditorContent(newContent);
    }

    useEffect(() => {
        const result = renderSong(
            { ...songData, content: editorContent },
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
                    <HeaderField label="Date Added" onChange={setDateAdded} placeholder="25-02" value={dateAdded} />
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
                <Textarea className='resize-none main-container' onInput={e => onEditorChange(e)} value={editorContent} />
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