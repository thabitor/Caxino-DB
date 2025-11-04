import { useState, useMemo } from "react";
import Link from "next/link";
import { PlayerWithTasks, VipLevel, getFullName, vipConfig } from "@/services/playerService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Trash2, Edit, Plus, Bell, Phone } from "lucide-react";
import { TaskCountBadge } from "./TaskCountBadge";
import { CopyButton } from "./CopyButton";

type SortField = keyof PlayerWithTasks | "task_count";
type SortDirection = "asc" | "desc";

interface PlayersTableProps {
  players: PlayerWithTasks[];
  onEdit: (player: PlayerWithTasks) => void;
  onDelete: (id: string) => void;
  onAddTask?: (playerId: string) => void;
}

const SortableHeader = ({ children, field, sortField, sortDirection, onSort }: { children: React.ReactNode; field: SortField; sortField: SortField; sortDirection: SortDirection; onSort: (field: SortField) => void; }) => {
  const isSorted = sortField === field;
  return (
    <TableHead onClick={() => onSort(field)} className="cursor-pointer hover:bg-muted/50">
      <div className="flex items-center gap-2">
        {children}
        <ArrowUpDown className={`h-4 w-4 ${isSorted ? "" : "text-muted-foreground"}`} />
      </div>
    </TableHead>
  );
};

export function PlayersTable({ players, onEdit, onDelete, onAddTask }: PlayersTableProps) {
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filter, setFilter] = useState("");
  const [vipFilter, setVipFilter] = useState<string>("all");

  const handleSort = (field: SortField) => {
    setSortDirection(sortField === field && sortDirection === "asc" ? "desc" : "asc");
    setSortField(field);
  };

  const filteredAndSortedPlayers = useMemo(() => {
    const filtered = players.filter((player) => {
      const lowerCaseFilter = filter.toLowerCase();
      const vipLevelMatch = vipFilter === "all" || String(player.vip_level) === vipFilter;

      return vipLevelMatch && (
        getFullName(player).toLowerCase().includes(lowerCaseFilter) ||
        player.username.toLowerCase().includes(lowerCaseFilter) ||
        (player.email || "").toLowerCase().includes(lowerCaseFilter)
      );
    });

    return filtered.sort((a, b) => {
      const aVal = sortField === 'task_count' ? a.tasks[0]?.count ?? 0 : a[sortField as keyof PlayerWithTasks] as any;
      const bVal = sortField === 'task_count' ? b.tasks[0]?.count ?? 0 : b[sortField as keyof PlayerWithTasks] as any;
      
      const order = sortDirection === "asc" ? 1 : -1;

      if (aVal === null || aVal === undefined) return order;
      if (bVal === null || bVal === undefined) return -order;

      if (typeof aVal === "string" && typeof bVal === "string") return aVal.localeCompare(bVal) * order;
      if (aVal < bVal) return -1 * order;
      if (aVal > bVal) return 1 * order;
      
      return 0;
    });
  }, [players, filter, vipFilter, sortField, sortDirection]);

  const getTaskIndicators = (player: PlayerWithTasks) => {
    const taskCount = player.tasks[0]?.count ?? 0;
    const callCount = player.tasks[0]?.call_count ?? 0;
    
    return (
      <div className="flex items-center gap-2">
        {taskCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700">
            <Bell className="w-3 h-3 text-amber-700 dark:text-amber-300" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">{taskCount}</span>
          </div>
        )}
        {callCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700">
            <Phone className="w-3 h-3 text-blue-700 dark:text-blue-300" />
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{callCount}</span>
          </div>
        )}
      </div>
    );
  };

  const getRowHighlight = (player: PlayerWithTasks) => {
    const taskCount = player.tasks[0]?.count ?? 0;
    const callCount = player.tasks[0]?.call_count ?? 0;
    
    if (taskCount > 0 && callCount > 0) {
      return "bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-100/50 dark:hover:bg-purple-950/30";
    }
    if (callCount > 0) {
      return "bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-950/30";
    }
    if (taskCount > 0) {
      return "bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-950/30";
    }
    return "hover:bg-muted/50";
  };

  return (
    <div className="w-full">
      <div className="flex items-center py-4 gap-4">
        <Input placeholder="Filter players..." value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm" />
        <Select value={vipFilter} onValueChange={setVipFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by VIP" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All VIP Levels</SelectItem>
            {(Object.entries(vipConfig) as [string, any][]).map(([level, config]) => (
              <SelectItem key={level} value={level}>{config.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader field="username" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Username</SortableHeader>
              <SortableHeader field="firstname" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Full Name</SortableHeader>
              <SortableHeader field="email" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Email</SortableHeader>
              <SortableHeader field="phone" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Phone</SortableHeader>
              <SortableHeader field="vip_level" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>VIP Level</SortableHeader>
              <SortableHeader field="task_count" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Tasks</SortableHeader>
              <TableHead>Reminders</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedPlayers.length > 0 ? (
              filteredAndSortedPlayers.map((player) => (
                <TableRow key={player.id} className={getRowHighlight(player)}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Link href={`/player/${player.id}`} className="hover:underline text-blue-600 dark:text-blue-400">{player.username}</Link>
                      <CopyButton text={player.username} label="Username" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{getFullName(player)}</span>
                      <CopyButton text={getFullName(player)} label="Name" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{player.email}</span>
                      <CopyButton text={player.email} label="Email" />
                    </div>
                  </TableCell>
                  <TableCell>
                    {player.phone ? (
                      <div className="flex items-center gap-2">
                        <span>{player.phone}</span>
                        <CopyButton text={player.phone} label="Phone" />
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic text-sm">Not provided</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${vipConfig[player.vip_level as VipLevel].bgColor} ${vipConfig[player.vip_level as VipLevel].color} hover:${vipConfig[player.vip_level as VipLevel].bgColor}`}>
                      {player.vip_level} - {vipConfig[player.vip_level as VipLevel].name}
                    </Badge>
                  </TableCell>
                  <TableCell><TaskCountBadge count={player.tasks[0]?.count ?? 0} /></TableCell>
                  <TableCell>{getTaskIndicators(player)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {onAddTask && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => onAddTask(player.id)}
                          title="Add task for this player"
                          className="hover:bg-blue-100 dark:hover:bg-blue-900/30"
                        >
                          <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => onEdit(player)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(player.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={8} className="h-24 text-center">No players found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
