
import React, { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { useViewSettingsStore } from '../hooks/viewSettingsStore'

interface SongViewLayoutProps {
    children: React.ReactNode
}

export const SongViewLayout = forwardRef<HTMLDivElement, SongViewLayoutProps>(
    ({ children }, ref) => {
        const { layout } = useViewSettingsStore()

        return (
            <div
                className={cn(
                    'flex flex-col sm:pt-[80px] pt-[72px] relative',
                    layout.fitScreenMode === 'fitXY' ? 'h-dvh' : 'min-h-dvh'
                )}
                ref={ref}
                style={{
                    touchAction: 'pan-y',// Prevent default pinch-to-zoom behavior
                    userSelect: 'none',  // Prevent text selection
                    // transition: 'font-size 0.2s ease',
                }}
            >
                {children}
            </div>
        )
    }
)