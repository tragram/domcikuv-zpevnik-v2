import { SongData } from '@/types/types';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import SongHeading from '../components/SongHeading';
import { LayoutSettings } from '../hooks/viewSettingsStore';
import '../SongView.css';
import { renderSong } from '../utils/songRendering';
import './Editor.css';

import useLocalStorageState from 'use-local-storage-state';
import CollapsibleMainArea from './components/CollapsibleMainArea';
import MetadataField from './components/MetadataField';
import ContentEditor from './ContentEditor';
import { DataForSongView } from '@/components/song_loader';
import { useLoaderData } from 'react-router-dom';

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
    const { songDB, songData: songDataURL } = useLoaderData() as DataForSongView;

    //TODO: perhaps the editors on different URLs should have different 
    const [editorState, setEditorState] = useLocalStorageState<EditorState>(
        "editor/state",
        { defaultValue: defaultEditorState }
    );

    useLayoutEffect(() => {
        if (songDataURL) {
            setEditorState({
                content: songDataURL.content || "Nothing to show... ;-)",
                metadata: {
                    title: songDataURL.title.toString(),
                    artist: songDataURL.artist.toString(),
                    key: songDataURL.key?.toString() || "",
                    dateAdded: `${songDataURL.dateAdded.year % 100}-${songDataURL.dateAdded.month.toString().padStart(2, "0")}`,
                    songbooks: songDataURL.songbooks.toString(),
                    startMelody: songDataURL.startMelody?.toString() || "",
                    language: songDataURL.language.toString(),
                    tempo: songDataURL.tempo.toString(),
                    capo: songDataURL.capo.toString(),
                    range: songDataURL.range.toString()
                }
            })
        }
    }, [setEditorState, songDataURL])

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
        <div className='flex flex-col md:flex-row h-fit md:h-dvh w-screen overflow-hidden'>
            <div className='flex flex-col md:flex-row h-full w-full gap-4 p-4 lg:gap-8 lg:p-8 overflow-auto'>
                <CollapsibleMainArea title={"Metadata"} className={"basis-[20%] 2xl:basis-[15%] md:max-w-[750px]"}>
                    <div className='main-container space-y-2'>
                        <MetadataField
                            label="Title"
                            onChange={(value) => updateMetadata('title', value)}
                            placeholder="Apassionata v F"
                            value={editorState.metadata.title}
                        />
                        <MetadataField
                            label="Artist"
                            onChange={(value) => updateMetadata('artist', value)}
                            placeholder="František Omáčka"
                            value={editorState.metadata.artist}
                        />
                        <MetadataField
                            label="Capo"
                            onChange={(value) => updateMetadata('capo', value)}
                            placeholder="0"
                            value={editorState.metadata.capo}
                        />
                        <MetadataField
                            label="Date Added"
                            onChange={(value) => updateMetadata('dateAdded', value)}
                            placeholder="25-02"
                            value={editorState.metadata.dateAdded}
                            description="Use YY-MM format."
                        />
                        <MetadataField
                            label="Language"
                            onChange={(value) => updateMetadata('language', value)}
                            placeholder="czech"
                            value={editorState.metadata.language}
                            description="If language not already present in some other song, flag might not be shown."
                        />
                        <MetadataField
                            label="Key"
                            onChange={(value) => updateMetadata('key', value)}
                            placeholder="Dm"
                            value={editorState.metadata.key}
                            description="Use note name (with #/b into denote sharp/flat) for major key and append 'm' or 'mi' to indicate minor key."
                        />
                        <MetadataField
                            label="Songbooks"
                            onChange={(value) => updateMetadata('songbooks', value)}
                            placeholder='["Domčík", "Kvítek"]'
                            value={editorState.metadata.songbooks}
                            description="Comma separated list with names in double quotes."
                        />
                        <MetadataField
                            label="Range"
                            onChange={(value) => updateMetadata('range', value)}
                            placeholder="e.g. c1-g2"
                            value={editorState.metadata.range}
                            description="Also used for vocal range. See README. ;-)"
                        />
                        <MetadataField
                            label="Start Melody"
                            onChange={(value) => updateMetadata('startMelody', value)}
                            placeholder="c# d e"
                            value={editorState.metadata.startMelody}
                            description="Currently not used so not very standardized across the songs."
                        />
                        <MetadataField
                            label="Tempo"
                            onChange={(value) => updateMetadata('tempo', value)}
                            placeholder="123"
                            value={editorState.metadata.tempo}
                            description="In BPM. Currently not used and very few songs have it."
                        />
                    </div>
                </CollapsibleMainArea>
                <CollapsibleMainArea title={"Editor"} className={"basis-[40%]"} isEditor={true}>
                    <ContentEditor
                        editorContent={editorState.content}
                        setEditorContent={updateContent}
                    />
                </CollapsibleMainArea>
                <CollapsibleMainArea title={"Preview"} className={"basis-[40%]"}>
                    <div className='main-container editor-preview-container'>
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
        </div>
    );
};

export default Editor;