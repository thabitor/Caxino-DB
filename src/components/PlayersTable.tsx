import { useState, useMemo } from "react";
import Link from "next/link";
import { PlayerWithTasks, VipLevel, getFullName, vipTierName, vipConfig } from "@/services/playerService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Trash2, Edit } from "lucide-react";
import { TaskCountBadge } from "./TaskCountBadge";

type SortField = keyof PlayerWithTasks | "task_count";
type SortDirection = "asc" | "desc";

interface PlayersTableProps {
  players: PlayerWithTasks[];
  onEdit: (player: PlayerWithTasks) => void;
  onDelete: (player: PlayerWithTasks) => void;
}

const SortableHeader = ({
  children,
  field,
  sortField,
  sortDirection,
  onSort,
}: {
  children: React.ReactNode;
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}) => {
  const isSorted = sortField === field;
  return (
    <TableHead onClick={() => onSort(field)} className="cursor-pointer hover:bg-muted/50">
      <div className="flex items-center gap-2">
        {children}
        {isSorted ? (
          sortDirection === "asc" ? (
            <ArrowUpDown className="h-4 w-4" />
          ) : (
            <ArrowUpDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </TableHead>
  );
};

export function PlayersTable({ players, onEdit, onDelete }: PlayersTableProps) {
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filter, setFilter] = useState("");
  const [vipFilter, setVipFilter] = useState<VipLevel | "all">("all");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredAndSortedPlayers = useMemo(() => {
    const filtered = players.filter((player) => {
      const fullName = getFullName(player);
      const lowerCaseFilter = filter.toLowerCase();
      const vipLevelMatch = vipFilter === "all" || player.vip_level === vipFilter;

      return (
        vipLevelMatch &&
        (fullName.toLowerCase().includes(lowerCaseFilter) ||
          player.username.toLowerCase().includes(lowerCaseFilter) ||
          player.email.toLowerCase().includes(lowerCaseFilter))
      );
    });

    return filtered.sort((a, b) => {
      let aValue, bValue;

      if (sortField === "task_count") {
        aValue = a.tasks[0]?.count ?? 0;
        bValue = b.tasks[0]?.count ?? 0;
      } else {
        aValue = a[sortField as keyof PlayerWithTasks];
        bValue = b[sortField as keyof PlayerWithTasks];
      }

      if (aValue === null || aValue === undefined) return sortDirection === "asc" ? -1 : 1;
      if (bValue === null || bValue === undefined) return sortDirection === "asc" ? 1 : -1;

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      // Fallback for dates or other types
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      
      return 0;
    });
  }, [players, filter, vipFilter, sortField, sortDirection]);

  return (
    <div className="w-full">
      <div className="flex items-center py-4 gap-4">
        <Input
          placeholder="Filter by name, username, or email..."
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="max-w-sm"
        />
        <Select
          value={String(vipFilter)}
          onValueChange={(value) => setVipFilter(value === "all" ? "all" : (Number(value) as VipLevel))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by VIP" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All VIP Levels</SelectItem>
            {(Object.keys(vipTierName) as unknown as VipLevel[]).map((level) => (
              <SelectItem key={level} value={String(level)}>
                {vipTierName[level]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader field="username" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                Username
              </SortableHeader>
              <SortableHeader field="firstname" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                Full Name
              </SortableHeader>
              <SortableHeader field="email" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                Email
              </SortableHeader>
              <SortableHeader field="vip_level" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                VIP Level
              </SortableHeader>
               <SortableHeader field="task_count" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                Tasks
              </SortableHeader>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedPlayers.length > 0 ? (
              filteredAndSortedPlayers.map((player) => (
                <TableRow key={player.id}>
                  <TableCell className="font-medium">
                    <Link href={`/player/${player.id}`} className="hover:underline text-blue-600 dark:text-blue-400">
                      {player.username}
                    </Link>
                  </TableCell>
                  <TableCell>{getFullName(player)}</TableCell>
                  <TableCell>{player.email}</TableCell>
                  <TableCell>
                    <Badge className={`${vipConfig[player.vip_level].bgColor} ${vipConfig[player.vip_level].color} hover:${vipConfig[player.vip_level].bgColor}`}>
                      {vipConfig[player.vip_level].name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <TaskCountBadge count={player.tasks[0]?.count ?? 0} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(player)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(player)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No players found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
