import { CheckCircle2, Clock, Archive, XCircle, Trash2 } from "lucide-react";
import { Badge } from "./ui/badge";

const SongVersionStatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case "published":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Published
        </Badge>
      );
    case "pending":
      return (
        <Badge
          variant="secondary"
          className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200"
        >
          <Clock className="w-3 h-3 mr-1" /> Pending
        </Badge>
      );
    case "archived":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <Archive className="w-3 h-3 mr-1" /> Archived
        </Badge>
      );
    case "rejected":
      return (
        <Badge
          variant="destructive"
          className="bg-red-100 text-white/90 hover:bg-red-100 border-red-200"
        >
          <XCircle className="w-3 h-3 mr-1" /> Rejected
        </Badge>
      );
    case "deleted":
      return (
        <Badge
          variant="destructive"
          className="bg-red-100 text-white/90 hover:bg-red-100 border-red-200"
        >
          <Trash2 className="w-3 h-3 mr-1" /> Deleted
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default SongVersionStatusBadge;
