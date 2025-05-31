import { useState, useCallback } from 'react'

export const useToolbarVisibility = () => {
    const [isVisible, setIsVisible] = useState(true)

    const updateVisibility = useCallback((visible: boolean) => {
        setIsVisible(visible)
    }, [])

    return {
        isVisible,
        updateVisibility
    }
}
