
import { cn } from "@/lib/utils"

const ToolbarBase = ({ children, className, showToolbar = true}) => {
    return (
        <div className={cn('flex justify-center w-full h-26 fixed p-2 sm:p-4 z-30 toolbar ' + (showToolbar ? "visible-toolbar" : "hidden-toolbar"), className)}>
            <div className='w-fit xs:w-full xl:w-fit h-14 bg-glass/10 backdrop-blur-md rounded-full shadow-md flex gap-2 p-2 items-center  outline-primary dark:outline-primary/30 outline outline-2 justify-left' id="navbar">
                {children}
            </div>
        </div>
    )
}

export default ToolbarBase;