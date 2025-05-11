
import { ModeToggleInner } from '@/components/mode-toggle'
import RandomSong, { ResetBanListDropdownItems } from '@/components/RandomSong'
import { DataForSongView } from '@/components/song_loader'
import { Button } from '@/components/ui/button'
import { DropdownIconStart, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import ToolbarBase from '@/components/ui/toolbar-base'
import usePWAInstall from '@/components/usePWAInstall'
import { Key } from '@/types/musicTypes'
import { Fullscreen, Github, Pencil, Settings2, Undo2 } from 'lucide-react'
import React from 'react'
import { FullScreenHandle } from 'react-full-screen'
import { Link, useNavigate } from 'react-router-dom'
import { useScrollHandler } from '../hooks/useScrollHandler'
import { useViewSettingsStore } from '../hooks/viewSettingsStore'
import { ChordSettingsButtons, ChordSettingsDropdownMenu } from './ChordSettingsMenu'
import { LayoutSettingsDropdownSection, LayoutSettingsToolbar } from './LayoutSettings'
import TransposeSettings from './TransposeSettings'

interface ToolbarProps {
    songDB: DataForSongView['songDB']
    songData: DataForSongView['songData']
    fullScreenHandle: FullScreenHandle
    originalKey: Key | undefined
    transposeSteps: number
    setTransposeSteps: (value: number) => void
}

export const Toolbar: React.FC<ToolbarProps> = ({
    songDB,
    songData,
    fullScreenHandle,
    originalKey,
    transposeSteps,
    setTransposeSteps
}) => {
    const { layout } = useViewSettingsStore();
    const navigate = useNavigate();
    const { isToolbarVisible } = useScrollHandler(layout.fitScreenMode);

    const { PWAInstallComponent, installItem } = usePWAInstall();
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
                    <DropdownMenuContent className="w-56 max-h-[85dvh] overflow-y-auto">
                        {React.Children.toArray(<LayoutSettingsDropdownSection/>)}
                        {React.Children.toArray(<ChordSettingsDropdownMenu />)}
                        <DropdownMenuLabel>Theme</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {React.Children.toArray(<ModeToggleInner />)}
                        <DropdownMenuLabel>Misc</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { fullScreenHandle.enter() }}>
                            <DropdownIconStart icon={<Fullscreen />} />
                            Enter fullscreen
                        </DropdownMenuItem >
                        {React.Children.toArray(<ResetBanListDropdownItems songDB={songDB} />)}
                        <DropdownMenuItem>
                            <DropdownIconStart icon={<Pencil />} />
                            <Link className='w-full h-full'
                                to={"/editor/" + songData.id}>
                                Edit here
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <DropdownIconStart icon={<Github />} />
                            <Link className='w-full h-full'
                                to={"https://github.com/tragram/domcikuv-zpevnik-v2/tree/main/songs/chordpro/" + songData.chordproFile}>
                                Edit on GitHub
                            </Link>
                        </DropdownMenuItem>
                        {installItem}
                    </DropdownMenuContent >
                </DropdownMenu>
                <RandomSong songs={songDB.songs} currentSong={songData} />
            </ToolbarBase>
            {PWAInstallComponent}
        </div>
    )
}