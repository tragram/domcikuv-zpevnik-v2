import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


const HeaderField: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder?: string }> = ({ label, value, onChange, placeholder }) => (
    <div className="grid w-full max-w-sm items-center mt-2">
        <Label>{label}</Label>
        <Input placeholder={value ? undefined : placeholder || label} value={value} onChange={(e) => { onChange(e.target.value) }} className='border-muted border-2 p-1 focus:border-primary focus:bg-primary/30' />
    </div>
);

export default HeaderField;