import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


interface MetadataFieldProps {
    label: string;
    value: string;
    placeholder?: string;
    description?: string;
    onChange: (value: string) => void;
}

const MetadataField: React.FC<MetadataFieldProps> = ({ label, value, placeholder, description, onChange }) => (
    <div className="w-full items-center space-y-0.5">
        <Label className="text-sm">{label}</Label>
        <Input placeholder={value ? undefined : placeholder || label} value={value} onChange={(e) => { onChange(e.target.value) }} className='border-muted border-2 focus:border-primary focus:bg-primary/30 p-1' />
        {description && <p className="text-xs text-primary/50">{description}</p>}
    </div>
);

export default MetadataField;