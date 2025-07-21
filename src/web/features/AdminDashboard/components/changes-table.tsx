import { useState } from "react"
import { Input } from "~/components/shadcn-ui/input"
import { Badge } from "~/components/shadcn-ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/shadcn-ui/table"
import { Button } from "~/components/shadcn-ui/button"
import { Search, ExternalLink, User } from "lucide-react"

interface SongChange {
  id: string
  songId: string
  songTitle: string
  userId: string
  userName: string
  timestamp: Date
  chordproURL: string
}

const mockChanges: SongChange[] = [
  {
    id: "1",
    songId: "1",
    songTitle: "Amazing Grace",
    userId: "1",
    userName: "John Doe",
    timestamp: new Date("2024-01-20T10:30:00"),
    chordproURL: "https://example.com/amazing-grace-v2.cho",
  },
  {
    id: "2",
    songId: "2",
    songTitle: "How Great Thou Art",
    userId: "2",
    userName: "Jane Smith",
    timestamp: new Date("2024-01-19T14:15:00"),
    chordproURL: "https://example.com/how-great-thou-art-v3.cho",
  },
  {
    id: "3",
    songId: "1",
    songTitle: "Amazing Grace",
    userId: "1",
    userName: "John Doe",
    timestamp: new Date("2024-01-18T09:45:00"),
    chordproURL: "https://example.com/amazing-grace-v1.cho",
  },
  {
    id: "4",
    songId: "3",
    songTitle: "Be Thou My Vision",
    userId: "3",
    userName: "Bob Wilson",
    timestamp: new Date("2024-01-17T16:20:00"),
    chordproURL: "https://example.com/be-thou-my-vision-v1.cho",
  },
  {
    id: "5",
    songId: "2",
    songTitle: "How Great Thou Art",
    userId: "1",
    userName: "John Doe",
    timestamp: new Date("2024-01-16T11:10:00"),
    chordproURL: "https://example.com/how-great-thou-art-v2.cho",
  },
]

export function ChangesTable() {
  const [changes] = useState<SongChange[]>(mockChanges)
  const [searchTerm, setSearchTerm] = useState("")

  const filteredChanges = changes.filter(
    (change) =>
      change.songTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      change.userName.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const sortedChanges = filteredChanges.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Song Changes</h3>
        <Badge variant="outline" className="text-sm">
          {changes.length} total changes
        </Badge>
      </div>

      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search changes..."
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
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedChanges.map((change) => (
              <TableRow key={change.id}>
                <TableCell className="font-medium">{change.songTitle}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {change.userName}
                  </div>
                </TableCell>
                <TableCell>{change.timestamp.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{getTimeAgo(change.timestamp)}</Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => window.open(change.chordproURL, "_blank")}>
                    <ExternalLink className="h-4 w-4" />
                    View Version
                  </Button>
                </TableCell>
              </TableRow>
            ))}
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
