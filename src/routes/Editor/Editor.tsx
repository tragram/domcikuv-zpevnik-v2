import { emptySongMetadata, SongData, SongMetadata } from '@/types/songData';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import useLocalStorageState from 'use-local-storage-state';
import { useLoaderData } from 'react-router-dom';
import '../Songview/SongView.css';
import './Editor.css';
import CollapsibleMainArea from './components/CollapsibleMainArea';
import ContentEditor from './ContentEditor';
import Preview from './Preview';
import MetadataEditor from './MetadataEditor';
import { DataForSongView } from '@/components/song_loader';
import { renderSong } from '../SongView/utils/songRendering';
import { Button } from '@/components/ui/button';

export interface EditorState {
    content: string;
    metadata: SongMetadata
}

const editorStatesEqual = (a: EditorState, b: EditorState) => {
    if (a.content !== b.content) {
        return false;
    }

    const aMetadataKeys = Object.keys(a.metadata).sort();
    const bMetadataKeys = Object.keys(b.metadata).sort();

    if (aMetadataKeys.length !== bMetadataKeys.length) {
        return false;
    }
    return aMetadataKeys.every((key) => a.metadata[key as keyof SongMetadata] == b.metadata[key as keyof SongMetadata]);
};


const songData2State = (songData: SongData) => {
    return {
        content: songData.content || "Nothing to show... ;-)",
        metadata: songData.extractMetadata()
    }
}

const Editor: React.FC = () => {
    const { songDB, songData: songDataURL } = useLoaderData() as DataForSongView;
    const editorStateKey = songDataURL ? `editor/state/${songDataURL.id}` : "editor/state";
    const defaultEditorState = useMemo(() => {
        if (songDataURL) {
            return songData2State(songDataURL);
        } else {
            return {
                content: "",
                metadata: emptySongMetadata()
            };
        }
    }, [songDataURL]);

    const [editorState, setEditorState] = useLocalStorageState<EditorState>(
        editorStateKey, { defaultValue: defaultEditorState });


    const initializeEditor = useCallback(() => {
        setEditorState(defaultEditorState);
    }, [setEditorState, defaultEditorState]);

    const backupEditorState = useCallback((editorState: EditorState) => {
        if (!editorStatesEqual(editorState, defaultEditorState)) {
            localStorage.setItem(editorStateKey + "-backup", JSON.stringify(editorState));
        } else {
            console.log("Backup not done, current state is equal to default!")
        }
    }, [defaultEditorState, editorStateKey])

    const loadBackupState = useCallback(() => {
        setEditorState(JSON.parse(localStorage.getItem(editorStateKey + "-backup") ?? ""));
    }, [editorStateKey, setEditorState])

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
            <div className='absolute'>
                <Button onClick={() => { backupEditorState(editorState); initializeEditor() }}>{songDataURL ? "Reload song" : "Clear"}</Button>
                <Button onClick={() => { loadBackupState() }}>Undo</Button>
            </div>
            <div className='flex flex-col md:flex-row h-full w-full gap-4 p-4 lg:gap-8 lg:p-8 overflow-auto'>
                <CollapsibleMainArea title={"Metadata"} className={"basis-[20%] 2xl:basis-[15%] md:max-w-[750px]"}>
                    <MetadataEditor
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