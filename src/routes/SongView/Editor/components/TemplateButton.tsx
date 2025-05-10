import { Button } from "@/components/ui/button";

interface TemplateButtonProps {
    templateKey: string;
    text: string;
    onInsert: (key: string) => void;
    className?: string;
}

const TemplateButton: React.FC<TemplateButtonProps> = ({
    templateKey,
    text,
    onInsert,
    className = "bg-primary text-white hover:bg-primary/80 text-xs py-1 px-2"
}) => (
    <Button
        onClick={() => onInsert(templateKey)}
        className={className}
    >
        {text}
    </Button>
);

export default TemplateButton;