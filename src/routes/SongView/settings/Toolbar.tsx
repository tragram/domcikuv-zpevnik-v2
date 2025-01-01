
import React, { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownIconStart, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import ToolbarBase from '@/components/ui/toolbar-base'
import { Settings2, Github, Undo2, Save } from 'lucide-react'
import { Link } from 'react-router-dom'
import RandomSong from '@/components/RandomSong'
import { DataForSongView, resolveAssetPath } from '@/components/song_loader'
import { ModeToggleInner } from '@/components/mode-toggle'
import { ChordSettingsButtons, ChordSettingsDropdownMenu } from './ChordSettingsMenu'
import { LayoutSettingsDropdownSection, LayoutSettingsToolbar } from './LayoutSettings'
import TransposeSettings from './TransposeSettings'
import { FullScreenHandle } from 'react-full-screen'
import { useScrollHandler } from '../hooks/useScrollHandler'
import { useViewSettingsStore } from '../hooks/viewSettingsStore'
import { Key } from '@/types/musicTypes'
import usePWAInstall from '@/components/usePWAInstall'

interface ToolbarProps {
    navigate: (path: string) => void
    songDB: DataForSongView['songDB']
    songData: DataForSongView['songData']
    fullScreenHandle: FullScreenHandle
    originalKey: Key | undefined
    transposeSteps: number
    setTransposeSteps: (value: number) => void
}

export const Toolbar: React.FC<ToolbarProps> = ({
    navigate,
    songDB,
    songData,
    fullScreenHandle,
    originalKey,
    transposeSteps,
    setTransposeSteps
}) => {
    const { layout } = useViewSettingsStore();
    const { isToolbarVisible } = useScrollHandler(layout.fitScreenMode);

    const { showInstallPrompt, PWAInstallComponent, installNative } = usePWAInstall();

    return (
        <div className="absolute top-0 w-full">
            <ToolbarBase showToolbar={isToolbarVisible} scrollOffset={window.scrollY}>
                <Button size="icon" variant="circular" onClick={() => navigate("/")}>
                    <Undo2 />
                </Button>

                <ChordSettingsButtons />
                <LayoutSettingsToolbar fullScreenHandle={fullScreenHandle} />
                <TransposeSettings
                    originalKey={originalKey}
                    transposeSteps={transposeSteps}
                    setTransposeSteps={setTransposeSteps} />

                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="circular">
                            <Settings2 size={32} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 max-h-[90vh] overflow-y-scroll">
                        {React.Children.toArray(<LayoutSettingsDropdownSection fullScreenHandle={fullScreenHandle} />)}
                        {React.Children.toArray(<ChordSettingsDropdownMenu />)}
                        <DropdownMenuLabel>Theme</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {React.Children.toArray(<ModeToggleInner />)}
                        <DropdownMenuLabel>Misc</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <DropdownIconStart icon={<Github />} />
                            <Link
                                to={"https://github.com/tragram/domcikuv-zpevnik-v2/tree/main/songs/chordpro/" + songData.chordproFile}>
                                Edit on GitHub
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={installNative}
                        >
                            <DropdownIconStart icon={<Save />} />
                            Install app
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={showInstallPrompt}
                        >
                            <DropdownIconStart icon={<Save />} />
                            <div>Show Prompt
                                <p className='text-[0.7rem] leading-tight'>Works on Safari (Apple devices) and Chrome (Android/Windows)</p>
                            </div>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <RandomSong songs={songDB.songs} />
            </ToolbarBase>
            {PWAInstallComponent}
        </div>
    )
}