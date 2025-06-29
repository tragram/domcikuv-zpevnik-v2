import { cn } from "~/lib/utils";
import { useState } from "react";
import useLocalStorageState from "use-local-storage-state";

interface CollapsibleMainAreaProps {
    title: string;
    className?: string;
    children: React.ReactNode;
    isEditor?: boolean;
}

const CollapsibleMainArea: React.FC<CollapsibleMainAreaProps> = ({ title, className, children, isEditor = false }) => {
    const [isCollapsed, setIsCollapsed] = useLocalStorageState<boolean>(`editor/${title}-collapsed`, { defaultValue: false });
    const [isHovered, setIsHovered] = useState(false);
    // TODO: these should be uncollapsed when reloaded on a large screen
    return (isCollapsed ?
        <div className='flex flex-col  w-full h-fit md:h-full md:w-fit '>
            <div className='flex h-full font-extrabold p-2 border-primary border-4 rounded-md hover:bg-primary/30'>
                <h1 className="font-extrabold w-full text-2xl text-center text-primary md:[writing-mode:vertical-rl] md:rotate-180" onClick={() => { setIsCollapsed(false); setIsHovered(false) }}>
                    {title}
                </h1>
            </div>
        </div>
        :
        <div className={cn('flex flex-col overflow-hidden min-w-52 border-4 border-primary rounded-md',
            isEditor ? 'min-h-fit md:min-h-0' : '',
            'w-full md:w-0 md:flex-grow',
            className)}>
            <div className="max-md:hidden overflow-y-auto flex-grow">
                {children}
            </div>
            <h1
                className="font-extrabold text-2xl md:text-3xl relative text-center text-white cursor-pointer bg-primary md:pt-2 md:pb-1 pb-2 pt-1"
                onClick={() => setIsCollapsed(true)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className="flex items-center justify-center">
                    <div className={cn("w-0 h-0 border-t-8 border-b-8 border-l-8 border-t-transparent border-b-transparent border-l-white ml-2", isHovered ? "" : "opacity-0 select-none")}></div>
                    <span className='mx-4'>{title}</span>
                    <div className={cn("w-0 h-0 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-white mr-2", isHovered ? "" : "opacity-0 select-none")}></div>
                </div>
            </h1>
            <div className="md:hidden overflow-y-auto flex-grow">
                {children}
            </div>
        </div >
    );
};

export default CollapsibleMainArea;