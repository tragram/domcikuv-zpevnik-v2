import { SongData } from '@/types/songData';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import useLocalStorageState from 'use-local-storage-state';
import { useLoaderData } from 'react-router-dom';
import '../Songview/SongView.css';
import './Editor.css';
import CollapsibleMainArea from './components/CollapsibleMainArea';
import ContentEditor from './ContentEditor';
import Preview from './Preview';
import Metadata from './Metadata';
import { DataForSongView } from '@/components/song_loader';
import { renderSong } from '../SongView/utils/songRendering';

export interface EditorState {
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
        pdfFilenames: string;
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
        range: "",
        pdfFilenames: ""
    }
};

type EditorProps = {};

const Editor: React.FC<EditorProps> = () => {
    const { songDB, songData: songDataURL } = useLoaderData() as DataForSongView;

    //TODO: perhaps the editors on different URLs should have different states
    const [editorState, setEditorState] = useLocalStorageState<EditorState>(
        "editor/state",
        { defaultValue: defaultEditorState }
    );

    const [renderedResult, setRenderedResult] = useState("");

    useLayoutEffect(() => {
        if (songDataURL) {
            setEditorState({
                content: songDataURL.withoutMetadata() || "Nothing to show... ;-)",
                metadata: {
                    title: songDataURL.title.toString(),
                    artist: songDataURL.artist.toString(),
                    key: songDataURL.key?.toString() || "",
                    dateAdded: `${songDataURL.dateAdded.month.toString().padStart(2, "0")}-${songDataURL.dateAdded.year}`,
                    songbooks: songDataURL.songbooks.toString(),
                    startMelody: songDataURL.startMelody?.toString() || "",
                    language: songDataURL.language.toString(),
                    tempo: songDataURL.tempo.toString(),
                    capo: songDataURL.capo.toString(),
                    range: songDataURL.range.toString().replace(/ /g, ""),
                    pdfFilenames: songDataURL.pdfFilenames.toString()
                }
            })
        }
    }, [setEditorState, songDataURL]);

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

    useEffect(() => {
        const result = renderSong(
            songData,
            0, // transposeSteps
            true
        );
        setRenderedResult(result);
    }, [editorState, songData]);

    return (
        <div className='flex flex-col md:flex-row h-fit md:h-dvh w-screen overflow-hidden'>
            <div className='flex flex-col md:flex-row h-full w-full gap-4 p-4 lg:gap-8 lg:p-8 overflow-auto'>
                <CollapsibleMainArea title={"Metadata"} className={"basis-[20%] 2xl:basis-[15%] md:max-w-[750px]"}>
                    <Metadata 
                        metadata={editorState.metadata}
                        updateMetadata={updateMetadata}
                    />
                </CollapsibleMainArea>
                <CollapsibleMainArea title={"Editor"} className={"basis-[40%]"} isEditor={true}>
                    <ContentEditor
                        editorContent={editorState.content}
                        setEditorContent={updateContent}
                    />
                </CollapsibleMainArea>
                <CollapsibleMainArea title={"Preview"} className={"basis-[40%]"}>
                    <Preview 
                        songData={songData}
                        renderedContent={renderedResult}
                        metadata={editorState.metadata}
                        content={editorState.content}
                    />
                </CollapsibleMainArea>
            </div>
        </div>
    );
};

export default Editor;