import React from "react";
import { cn } from "@/lib/utils";
import { SongData } from "@/types/types";

interface BackgroundImageProps {
  songData: SongData;
  id: string;
  className?: string; 
}

const BackgroundImage: React.FC<BackgroundImageProps> = ({ songData, id, className }) => {
  return (
    <div
      className={cn(
        "absolute top-0 left-0 min-h-lvh h-full w-full bg-image -z-20 blur-lg overflow-hidden transition-all duration-1000 ease-in-out",
        className
      )}
      id={id}
      style={{ backgroundImage: `url(${songData.thumbnailURL()})` }}
    >
      <div className="w-full h-full bg-glass/60 dark:bg-glass/50"></div>
    </div>
  );
};

export default BackgroundImage;
