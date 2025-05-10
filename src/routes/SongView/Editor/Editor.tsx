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

// Define the complex state interface
interface EditorState {
    content: string;
    metadata: {
        title: string;
        artist: string;
        key: string;
        dateAdded: string;
        songbooks: string;
        startMelody: string;
        language: string;
        tempo: string;
        capo: string;
        range: string;
    };
}

// Default state
const defaultEditorState: EditorState = {
    content: "",
    metadata: {
        title: "",
        artist: "",
        key: "",
        dateAdded: "",
        songbooks: "",
        startMelody: "",
        language: "",
        tempo: "",
        capo: "",
        range: ""
    }
};

type EditorProps = {};

const Editor: React.FC<EditorProps> = () => {
    // Use a single state object with useLocalStorageState
    const [editorState, setEditorState] = useLocalStorageState<EditorState>(
        "editor/state",
        { defaultValue: defaultEditorState }
    );

    const [renderedResult, setRenderedResult] = useState("");

    // Helper function to update individual metadata fields
    const updateMetadata = (field: keyof EditorState['metadata'], value: string) => {
        setEditorState({
            ...editorState,
            metadata: {
                ...editorState.metadata,
                [field]: value
            }
        });
    };

    // Helper function to update the content
    const updateContent = (content: string) => {
        setEditorState({
            ...editorState,
            content
        });
    };

    // Create song data object from the metadata using useMemo
    const songData = React.useMemo(() => ({
        title: editorState.metadata.title,
        artist: editorState.metadata.artist,
        capo: editorState.metadata.capo,
        range: SongData.parseRange(editorState.metadata.range),
        dateAdded: editorState.metadata.dateAdded,
        songbooks: editorState.metadata.songbooks,
        language: editorState.metadata.language,
        tempo: editorState.metadata.tempo,
        content: editorState.content || "Nothing to show... ;-)"
    } as unknown as SongData), [editorState]);

    const layout = {} as LayoutSettings;
    const transposeSteps = 0;

    useEffect(() => {
        const result = renderSong(
            songData,
            transposeSteps,
            true
        );
        setRenderedResult(result);
    }, [editorState, songData]);

    return (
        <div className='flex flex-col md:flex-row h-fit md:h-dvh w-screen gap-4 p-4 lg:gap-8 lg:p-8'>
            <CollapsibleMainArea title={"Metadata"} className={"basis-[20%]"}>
                <div className='main-container'>
                    <HeaderField
                        label="Title"
                        onChange={(value) => updateMetadata('title', value)}
                        placeholder="Apassionata v F"
                        value={editorState.metadata.title}
                    />
                    <HeaderField
                        label="Artist"
                        onChange={(value) => updateMetadata('artist', value)}
                        placeholder="František Omáčka"
                        value={editorState.metadata.artist}
                    />
                    <HeaderField
                        label="Key"
                        onChange={(value) => updateMetadata('key', value)}
                        placeholder="Dm"
                        value={editorState.metadata.key}
                    />
                    <HeaderField
                        label="Date Added [YY-MM]"
                        onChange={(value) => updateMetadata('dateAdded', value)}
                        placeholder="25-02"
                        value={editorState.metadata.dateAdded}
                    />
                    <HeaderField
                        label="Songbooks"
                        onChange={(value) => updateMetadata('songbooks', value)}
                        placeholder='["Domčík", "Kvítek"]'
                        value={editorState.metadata.songbooks}
                    />
                    <HeaderField
                        label="Start Melody"
                        onChange={(value) => updateMetadata('startMelody', value)}
                        placeholder="c# d e"
                        value={editorState.metadata.startMelody}
                    />
                    <HeaderField
                        label="Language"
                        onChange={(value) => updateMetadata('language', value)}
                        placeholder="czech"
                        value={editorState.metadata.language}
                    />
                    <HeaderField
                        label="Tempo [bpm]"
                        onChange={(value) => updateMetadata('tempo', value)}
                        placeholder="123"
                        value={editorState.metadata.tempo}
                    />
                    <HeaderField
                        label="Range"
                        onChange={(value) => updateMetadata('range', value)}
                        placeholder="e.g. c1-g2"
                        value={editorState.metadata.range}
                    />
                    <HeaderField
                        label="Capo"
                        onChange={(value) => updateMetadata('capo', value)}
                        placeholder="0"
                        value={editorState.metadata.capo}
                    />
                </div>
            </CollapsibleMainArea>
            <CollapsibleMainArea title={"Editor"} className={"basis-[40%]"} isEditor={true}>
                <ContentEditor
                    editorContent={editorState.content}
                    setEditorContent={updateContent}
                />
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