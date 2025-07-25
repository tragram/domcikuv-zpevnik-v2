import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Input } from "~/components/ui/input"
import { Badge } from "~/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { Button } from "~/components/ui/button"
import { Search, ExternalLink, User, CheckCircle, XCircle } from "lucide-react"
import { verifyVersion } from "~/services/songs"
import { toast } from "sonner";
import { useRouteContext } from "@tanstack/react-router"

interface SongVersion {
  id: string
  songId: string
  songTitle: string
  userId: string
  userName: string
  timestamp: Date
  chordproURL: string
  verified: boolean
}

interface VersionsTableProps {
  initialVersions: SongVersion[]
}

export function VersionsTable({ initialVersions }: VersionsTableProps) {
  const [versions, setVersions] = useState<SongVersion[]>(
    initialVersions.map(change => ({
      ...change,
      timestamp: new Date(change.timestamp)
    }))
  )
  const [searchTerm, setSearchTerm] = useState("")
  
  const api = useRouteContext({ from: "/admin" }).api;
  const queryClient = useQueryClient()

  const verifyMutation = useMutation({
    mutationFn: ({ id, verified }: { id: string; verified: boolean }) => 
      verifyVersion(api.admin, id, verified),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["versionsAdmin"] })
      toast({
        title: "Success",
        description: "Change verification updated successfully",
      })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update change verification",
        variant: "destructive",
      })
    }
  })

  const filteredVersions = versions.filter(
    (version) =>
      version.songTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      version.userName?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const sortedVersions = filteredVersions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  const handleVerifyChange = async (id: string, verified: boolean) => {
    await verifyMutation.mutateAsync({ id, verified })
    setVersions(versions.map(change => 
      change.id === id ? { ...change, verified } : change
    ))
  }

  const unverifiedCount = versions.filter(change => !change.verified).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Song Versions</h3>
        <div className="flex gap-2">
          {unverifiedCount > 0 && (
            <Badge variant="destructive" className="text-sm">
              {unverifiedCount} unverified
            </Badge>
          )}
          <Badge variant="outline" className="text-sm">
            {versions.length} total versions
          </Badge>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search versions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Song</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>Time Ago</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedVersions.map((change) => (
              <TableRow key={change.id}>
                <TableCell className="font-medium">
                  {change.songTitle || "Unknown Song"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {change.userName || "Unknown User"}
                  </div>
                </TableCell>
                <TableCell>{change.timestamp.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{getTimeAgo(change.timestamp)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={change.verified ? "default" : "destructive"}>
                    {change.verified ? (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Verified
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Unverified
                      </div>
                    )}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => window.open(change.chordproURL, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                      View Version
                    </Button>
                    {!change.verified && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerifyChange(change.id, true)}
                        disabled={verifyMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Verify
                      </Button>
                    )}
                    {change.verified && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerifyChange(change.id, false)}
                        disabled={verifyMutation.isPending}
                      >
                        <XCircle className="h-4 w-4" />
                        Unverify
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sortedVersions.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No versions found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`
  } else if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}m ago`
  } else if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}h ago`
  } else {
    return `${Math.floor(diffInSeconds / 86400)}d ago`
  }
}