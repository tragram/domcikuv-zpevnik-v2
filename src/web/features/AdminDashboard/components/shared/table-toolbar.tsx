import { Input } from '~/components/ui/input';
import { Search } from 'lucide-react';

type Props = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  children?: React.ReactNode;
};

export const TableToolbar = ({ searchTerm, onSearchChange, children }: Props) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-sm"
        />
      </div>
      {children}
    </div>
  );
};
