import React from "react";
import { cn } from "@/lib/utils";
import { SongData } from '@/../types/songData';

interface BackgroundImageProps {
  songData: SongData;
  id: string;
  className?: string;
}

const BackgroundImage: React.FC<BackgroundImageProps> = ({ songData, id, className }) => {
  // the image has to be slightly larger than necessary to avoid vignetting - that is the reason for the outer wrapper
  return (
    <div className="absolute top-0 left-0 h-full w-full overflow-clip  -z-20">
      <div
        className={cn(
          "absolute -top-[5%] -left-[5%] h-[110%] w-[110%] bg-image blur-lg overflow-hidden transition-all duration-500 ease-in-out",
          className
        )}
        id={id}
        style={{ backgroundImage: `url(${songData.thumbnailURL()})` }}
      >
        <div className="w-full h-full
       bg-background/80
       dark:bg-glass/50"></div>
      </div>
    </div>
  );
};

export default BackgroundImage;
