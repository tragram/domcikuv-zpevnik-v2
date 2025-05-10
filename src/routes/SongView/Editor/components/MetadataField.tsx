import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


const MetadataField: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder?: string }> = ({ label, value, onChange, placeholder }) => (
    <div className="w-full max-w-sm items-center">
        <Label className="text-sm">{label}</Label>
        <Input placeholder={value ? undefined : placeholder || label} value={value} onChange={(e) => { onChange(e.target.value) }} className='border-muted border-2 focus:border-primary focus:bg-primary/30' />
        {/* <Text */}
    </div>
);

export default MetadataField;