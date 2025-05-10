import { SongData } from '@/types/types';
import React, { useEffect, useState } from 'react';
import SongHeading from '../components/SongHeading';
import { LayoutSettings } from '../hooks/viewSettingsStore';
import '../SongView.css';
import { renderSong } from '../utils/songRendering';
import './Editor.css';

import useLocalStorageState from 'use-local-storage-state';
import CollapsibleMainArea from './components/CollapsibleMainArea';
import HeaderField from './components/HeaderField';
import ContentEditor from './ContentEditor';
type EditorProps = {
};

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

    useEffect(() => {
        const result = renderSong(
            { ...songData, content: editorContent || "Nothing to show... ;-)" },
            transposeSteps,
            true
        )
        setRenderedResult(result);
    }, [editorContent, songData])

    return (
        <div className='flex flex-col md:flex-row h-fit md:h-dvh w-screen gap-4 p-4 lg:gap-8 lg:p-8'>
            <CollapsibleMainArea title={"Metadata"} className={"basis-[20%]"}>
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
            </CollapsibleMainArea>
            <CollapsibleMainArea title={"Editor"} className={"basis-[40%]"} isEditor={true}>
                <ContentEditor editorContent={editorContent} setEditorContent={setEditorContent} />
            </CollapsibleMainArea>
            <CollapsibleMainArea title={"Result"} className={"basis-[40%]"}>
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
            </CollapsibleMainArea>
        </div>
    );
};

export default Editor;