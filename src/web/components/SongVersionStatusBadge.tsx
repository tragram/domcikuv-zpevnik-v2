import { CheckCircle2, Clock, Archive, Star, XCircle, Trash2 } from "lucide-react";
import { Badge } from "./ui/badge";

const SongVersionStatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case "published":
      return (
        <Badge className="bg-success/10 text-success hover:bg-success/10 border-success/30">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Published
        </Badge>
      );
    case "pending":
      return (
        <Badge
          variant="secondary"
          className="bg-warning/10 text-warning hover:bg-warning/10 border-warning/30"
        >
          <Clock className="w-3 h-3 mr-1" /> Pending
        </Badge>
      );
    case "unofficial":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <Star className="w-3 h-3 mr-1" /> Unofficial
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
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" /> Rejected
        </Badge>
      );
    case "deleted":
      return (
        <Badge variant="destructive">
          <Trash2 className="w-3 h-3 mr-1" /> Deleted
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default SongVersionStatusBadge;
