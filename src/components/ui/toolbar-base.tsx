const ToolbarBase = ({ children, showToolbar = true }) => {
    return (
        <div className={'flex justify-center w-full h-26 fixed p-2 sm:p-4 z-50 toolbar ' + (showToolbar ? "visible-toolbar" : "hidden-toolbar")}>
            <div className='w-fit xs:w-full xl:w-fit h-14 bg-glass/10 backdrop-blur-md rounded-full shadow-md flex gap-2 p-2 items-center shadow-black dark:outline-primary/30 dark:outline dark:outline-2 justify-left' id="navbar">
                {children}
            </div>
        </div>
    )
}

export default ToolbarBase;