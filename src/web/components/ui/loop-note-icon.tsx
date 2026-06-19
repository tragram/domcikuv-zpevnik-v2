import loopNoteIconSvg from "./loop-note-icon.svg?raw";

export const LoopNoteIcon = () => (
  <span
    style={{ display: "contents" }}
    dangerouslySetInnerHTML={{ __html: loopNoteIconSvg }}
  />
);
