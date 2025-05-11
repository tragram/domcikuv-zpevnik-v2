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
import { cn } from '@/lib/utils';
import SettingsDropdown from './components/SettingsDropdown';
import DownloadButton from './components/DownloadButton';
import { RefreshCcw, Undo } from 'lucide-react';

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
    // TODO: use songDB for better songbook picker (dropdown)
    const editorStateKey = songDataURL ? `editor/state/${songDataURL.id}` : "editor/state";
    const defaultEditorState = useMemo(() => {
        if (songDataURL) {
            return songData2State(songDataURL);
        } else {
            const metadata = emptySongMetadata();
            const currentDate = new Date();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Months are 0-based
            const year = currentDate.getFullYear();
            metadata.dateAdded = `${month}-${year}`;
            return {
                content: "",
                metadata: metadata
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
        const backup = localStorage.getItem(editorStateKey + "-backup");
        if (backup) {
            setEditorState(JSON.parse(backup));
        }
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
        <div className='flex flex-col relative h-fit md:h-dvh gap-2 md:gap-4 min-w-[250px]'>
            <div className='flex flex-wrap w-auto mx-4 lg:mx-8 mt-4 border-4 border-primary rounded-md max-md:justify-around'>
                <Button onClick={() => { backupEditorState(editorState); initializeEditor() }}>
                    {songDataURL ? "Reload song" : "Clear"}
                    <RefreshCcw />
                </Button>
                <Button onClick={() => { loadBackupState() }}>
                    Undo reload
                    <Undo />
                </Button>
                <SettingsDropdown />
                <DownloadButton metadata={editorState.metadata} content={editorState.content} />
            </div>
            <div className={cn('flex flex-col md:flex-row w-full h-fit md:h-full overflow-hidden')}>
                <div className={cn('flex flex-col md:flex-row h-full w-full gap-4 p-4 lg:gap-8 lg:p-8 !pt-0 overflow-auto')}>
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
        </div>
    );
};

export default Editor;