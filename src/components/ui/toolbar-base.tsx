const ToolbarBase = ({ children, showToolbar = true }) => {
    return (
        <div className={'flex justify-center w-full h-26 fixed p-4 z-50 toolbar ' + (showToolbar ? "visible-toolbar" : "hidden-toolbar")}>
            <div className='container w-full h-14 bg-white/80 backdrop-blur-md rounded-full shadow-md flex gap-2 p-2 items-center' id="navbar">
                {children}
            </div>
        </div>
    )
}

export default ToolbarBase;