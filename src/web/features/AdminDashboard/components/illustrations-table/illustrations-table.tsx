import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "~/components/shadcn-ui/button";
import { Input } from "~/components/shadcn-ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/shadcn-ui/dialog";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useRouteContext } from "@tanstack/react-router";
import { createIllustration } from "~/services/songs";
import {
  IllustrationApiResponse,
  IllustrationCreateSchema,
} from "src/worker/api/admin/illustrations";
import { SongIllustrationsGroup } from "./illustration-group";
import { IllustrationForm } from "./illustration-form";

interface IllustrationsTableProps {
  illustrations: IllustrationApiResponse[];
}

export function IllustrationsTable({ illustrations }: IllustrationsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const filteredIllustrations = illustrations.filter(
    (illustration) =>
      illustration.song?.title
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      illustration.song?.artist
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      illustration.promptModel
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      illustration.imageModel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const adminApi = useRouteContext({ from: "/admin" }).api.admin;

  const createMutation = useMutation({
    mutationFn: async (data: IllustrationCreateSchema) => {
      return await createIllustration(adminApi, data);
    },
    onSuccess: () => {
      toast.success("Illustration created successfully");
      setIsDialogOpen(false);
    },
    onError: () => {
      toast.error("Failed to create illustration");
    },
  });

  const handleCreateIllustration = async (
    illustrationData: IllustrationCreateSchema
  ) => {
    try {
      await createMutation.mutateAsync(illustrationData);
    } catch (error) {
      console.error(error);
    }
  };

  const toggleGroup = (songId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(songId)) {
      newExpanded.delete(songId);
    } else {
      newExpanded.add(songId);
    }
    setExpandedGroups(newExpanded);
  };

  // Group illustrations by songId
  const groupedIllustrations = filteredIllustrations.reduce(
    (groups, illustration) => {
      const songId = illustration.songId;
      if (!groups[songId]) {
        groups[songId] = [];
      }
      groups[songId].push(illustration);
      return groups;
    },
    {} as Record<string, IllustrationApiResponse[]>
  );

  // Sort groups by song title
  const sortedGroups = Object.entries(groupedIllustrations).sort(
    ([, illustrationsA], [, illustrationsB]) => {
      const activeSum = (illustrations: IllustrationApiResponse[]) =>
        illustrations
          .map((i) => i.isActive)
          .reduce((a: number, c: boolean) => a + Number(c), 0);
      const activeA = activeSum(illustrationsA);
      const activeB = activeSum(illustrationsB);
      if (activeA + activeB !== 0) {
        if (activeA === 0) {
          return -1;
        }
        if (activeB === 0) {
          return 1;
        }
      }
      return illustrationsA[0].song.title.localeCompare(
        illustrationsB[0].song.title
      );
    }
  );

  return (
    <div className="space-y-4 p-4 w-full">
      <div className="flex flex-col sm:flex-row items-center justify-between">
        <div className="text-center sm:text-left">
          <h3 className="text-lg font-medium">Song Illustrations</h3>
          <p className="text-sm text-muted-foreground">
            {sortedGroups.length} songs • {filteredIllustrations.length}{" "}
            illustrations
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Illustration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Illustration</DialogTitle>
            </DialogHeader>
            <IllustrationForm
              illustration={null}
              onSave={handleCreateIllustration}
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2 flex-1 w-full">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search songs or illustrations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-xs sm:text-sm md:text-base"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setExpandedGroups(new Set(sortedGroups.map(([songId]) => songId)))
            }
          >
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedGroups(new Set())}
          >
            Collapse All
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {sortedGroups.map(([songId, illustrations]) => (
          <SongIllustrationsGroup
            key={songId}
            illustrations={illustrations}
            isExpanded={expandedGroups.has(songId)}
            onToggleExpanded={() => toggleGroup(songId)}
          />
        ))}

        {sortedGroups.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No illustrations found matching your search.
          </div>
        )}
      </div>
    </div>
  );
}
