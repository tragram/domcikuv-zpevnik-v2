import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { HelpCircle } from "lucide-react";
import Markdown from "react-markdown";

const defaultHelpText = `
# Basic ChordPro Syntax
## Chords
Place chords inside square brackets directly before the lyric syllable. 

  *Example:* \`[C]Hello [G]world!\`

## Environments
Wrap parts in {start_of_xyz} {end_of_xyz} to create verses, bridges, chorus or tabs.

*Example:* \`{start_of_verse}\n[C]Hello [G]world!\n{end_of_verse}\`

# Domčík's Extensions
For convenience, I have added the following features to ChordPro:
## Recalls
You have the possibility to keep in memory more than one chorus/verse/bridge. You can define the label of the chorus (note: it will be displayed!) in the directive by e.g. 
\`\`\`chordpro
{start_of_chorus: R1}
content1
{end_of_chorus}
{start_of_chorus: R2}
content2
{end_of_chorus}
\`\`\`
and them later recall them by 
\`\`\`
{chorus: R1}
{chorus: R2}
{chorus: R1}
\`\`\`
The labels may contain letters, numbers, spaces and the following special characters: \`+_-/.\`. In short, they must match \`[\\w\\-_+ .\\p{L}]+\`.

## Part variants
It is very common that a chorus is repeated with only a minor modification at the end. To avoid these repetitions, you can define a variant of the chorus as follows:
\`\`\`
{start_of_variant: replace_last_line}
This is the end.
{end_of_variant}
{chorus}
\`\`\`
This will replace the last line of the recall directive that follows (\`{chorus}\` in this case). If the part is collapsed, it will add a note that the last line is different. Make sure to repeat the chords again.

Generalization to more lines being replaced is planned but not implemented yet.

Another common occurrence is that the final chorus has an additional line. This can be defined analogously by using  \`{start_of_variant: append_content}\`.

Lastly, though less common, it might happen that a part has a variation at the start. For that, you have \`{start_of_variant: replace_first_line}\` and \`{start_of_variant: prepend_content}\`. These work analogously to their "end" counterparts.

Applying multiple variants at the same time is not possible - you'll just have to repeat yourself. ;)
`;

interface EditorHelpProps {
  markdownContent?: string;
}

const EditorHelp: React.FC<EditorHelpProps> = ({
  markdownContent = defaultHelpText,
}) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="hover:text-white bg-transparent">
          Help
          <HelpCircle className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      {/* max-h-[80vh] and overflow-y-auto ensure it remains responsive on smaller screens */}
      <DialogContent className="markdown max-w-2xl max-h-[80vh] overflow-y-auto text-[0.9em]">
        <DialogHeader>
          <DialogTitle className="sr-only">Editor Help</DialogTitle>
        </DialogHeader>
        {/* 'prose' formats the markdown tags to look clean and legible */}
        <Markdown>{markdownContent}</Markdown>
      </DialogContent>
    </Dialog>
  );
};

export default EditorHelp;
