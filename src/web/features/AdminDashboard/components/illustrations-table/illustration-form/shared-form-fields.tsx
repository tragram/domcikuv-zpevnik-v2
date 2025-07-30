import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface SharedFormFieldsProps {
  songId: string;
  isActive: boolean;
  onSongIdChange: (value: string) => void;
  onActiveChange: (checked: boolean) => void;
  mode: "ai" | "manual";
}

export function SongIdField({ songId, onSongIdChange, mode }: Pick<SharedFormFieldsProps, 'songId' | 'onSongIdChange' | 'mode'>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`${mode}-songId`}>Song ID</Label>
      <Input
        id={`${mode}-songId`}
        value={songId}
        onChange={(e) => onSongIdChange(e.target.value)}
        required
        disabled
      />
    </div>
  );
}

export function ActiveSwitch({ isActive, onActiveChange, mode }: Pick<SharedFormFieldsProps, 'isActive' | 'onActiveChange' | 'mode'>) {
  return (
    <div className="flex items-center space-x-2">
      <Switch
        id={`${mode}-isActive`}
        checked={isActive}
        onCheckedChange={onActiveChange}
      />
      <Label htmlFor={`${mode}-isActive`}>Active</Label>
    </div>
  );
}

interface ImageModelSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

export function ImageModelSelect({ value, onChange, options }: ImageModelSelectProps) {
  return (
    <div className="space-y-2">
      <Label>Image Model</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select image model" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
