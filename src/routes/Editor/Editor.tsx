import { DataForSongView } from '@/components/song_loader';
import { Button } from '@/components/ui/button';
import { emptySongMetadata, SongData, SongMetadata, songMetadataEqual } from '@/types/songData';
import React, { useCallback, useMemo } from 'react';
import { useLoaderData } from 'react-router-dom';
import useLocalStorageState from 'use-local-storage-state';
import '../Songview/SongView.css';
import CollapsibleMainArea from './components/CollapsibleMainArea';
import ContentEditor from './ContentEditor';
import './Editor.css';
import MetadataEditor from './MetadataEditor';
import Preview from './Preview';

export interface EditorState {
    content: string;
    metadata: SongMetadata
}

const editorStatesEqual = (a: EditorState, b: EditorState) => {
    if (a.content !== b.content) {
        return false;
    }
    return songMetadataEqual(a.metadata, b.metadata);
};

const songData2State = (songData: SongData) => {
    return {
        content: songData.content,
        metadata: songData.extractMetadata()
    } as EditorState
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
            } as EditorState;
        }
    }, [songDataURL]);

    const [editorState, setEditorState] = useLocalStorageState<EditorState>(
        editorStateKey, { defaultValue: () => defaultEditorState });


    const initializeEditor = useCallback(() => {
        setEditorState(defaultEditorState);
    }, [setEditorState, defaultEditorState]);

    const backupEditorState = useCallback((editorState: EditorState) => {
        if (!editorStatesEqual(editorState, defaultEditorState as EditorState)) {
            localStorage.setItem(editorStateKey + "-backup", JSON.stringify(editorState));
        }
    }, [defaultEditorState, editorStateKey])

    const loadBackupState = useCallback(() => {
        setEditorState(JSON.parse(localStorage.getItem(editorStateKey + "-backup") ?? ""));
    }, [editorStateKey, setEditorState])

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
                        metadata={editorState.metadata}
                        content={editorState.content}
                    />
                </CollapsibleMainArea>
            </div>
        </div>
    );
};

export default Editor;