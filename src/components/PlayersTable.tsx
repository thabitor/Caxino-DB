import { useState, useMemo, type ReactElement } from "react";
import { PlayerWithTasks, VipLevel, getFullName, vipConfig } from "@/services/playerService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, ArrowUpDown } from "lucide-react";
import { CopyButton } from "./CopyButton";
import { getBirthdayStatus } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type SortField = keyof PlayerWithTasks | "task_count";
type SortDirection = "asc" | "desc";
type TaskFilter = "all" | "with_tasks" | "with_calls" | "with_both" | "with_birthdays" | "to_follow_up";

interface PlayersTableProps {
  players: PlayerWithTasks[];
  onEdit: (player: PlayerWithTasks) => void;
  onDelete: (id: string) => void;
  onAddTask?: (playerId: string) => void;
  onAddFollowUp?: (player: PlayerWithTasks) => void;
  onOpenPlayer?: (playerId: string) => void;
  followUpViewedAtByPlayer?: Record<string, string>;
  lastCallAtByPlayer?: Record<string, string>;
  monthlyCallCountByPlayer?: Record<string, number>;
  toFollowUpPlayerIds?: string[];
}

const compactCell = "px-2 py-1.5 align-middle";
const compactNativeSelect = "h-8 rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

function DirectoryBadgeTooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getClosureKind(player: PlayerWithTasks) {
  return player.account_closure_type === "break" ? "temporary" : "permanent";
}

function getClosureLabel(player: PlayerWithTasks) {
  return getClosureKind(player) === "temporary" ? "Temporary break" : "Permanent";
}

const SortableHeader = ({ children, field, sortField, sortDirection, onSort }: { children: React.ReactNode; field: SortField; sortField: SortField; sortDirection: SortDirection; onSort: (field: SortField) => void; }) => {
  const isSorted = sortField === field;
  return (
    <TableHead
      aria-sort={isSorted ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
      onClick={() => onSort(field)}
      className="h-8 cursor-pointer px-2 text-xs hover:bg-muted/50"
    >
      <div className="flex items-center gap-1.5">
        {children}
        <ArrowUpDown className={`h-3.5 w-3.5 ${isSorted ? "" : "text-muted-foreground"}`} />
      </div>
    </TableHead>
  );
};

export function PlayersTable({ players, onOpenPlayer, followUpViewedAtByPlayer = {}, monthlyCallCountByPlayer = {}, toFollowUpPlayerIds = [] }: PlayersTableProps) {
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filter, setFilter] = useState("");
  const [vipFilter, setVipFilter] = useState<string>("all");
  const [casinoFilter, setCasinoFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [taskFilter] = useState<TaskFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const handleSort = (field: SortField) => {
    setSortDirection(sortField === field && sortDirection === "asc" ? "desc" : "asc");
    setSortField(field);
    setCurrentPage(1);
  };

  const handleFilterChange = (value: string) => {
    setFilter(value);
    setCurrentPage(1);
  };

  const handleVipFilterChange = (value: string) => {
    setVipFilter(value);
    setCurrentPage(1);
  };

  const handleCasinoFilterChange = (value: string) => {
    setCasinoFilter(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };

  // Get unique casino values for filter dropdown
  const uniqueCasinos = useMemo(() => {
    const casinos = new Set<string>();
    players.forEach(player => {
      if (player.casino) {
        casinos.add(player.casino);
      }
    });
    return Array.from(casinos).sort();
  }, [players]);

  const getAccountStatus = (player: PlayerWithTasks) => (player.account_status || "open").trim().toLowerCase();
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    players.forEach((player) => statuses.add(getAccountStatus(player)));
    return Array.from(statuses).sort();
  }, [players]);
  const toFollowUpPlayerIdSet = useMemo(() => new Set(toFollowUpPlayerIds), [toFollowUpPlayerIds]);

  const getStatusBadgeClass = (status: string, player?: PlayerWithTasks) => {
    switch (status.toLowerCase()) {
      case "closed":
        if (player?.account_closure_type === "break") {
          return "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300";
        }
        return "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300";
      case "suspended":
        return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300";
      default:
        return "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300";
    }
  };

  const formatStatus = (status: string) => (
    status
      .replace("_", " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );

  const filteredAndSortedPlayers = useMemo(() => {
    const filtered = players.filter((player) => {
      const lowerCaseFilter = filter.toLowerCase();
      const vipLevelMatch = vipFilter === "all" || String(player.vip_level) === vipFilter;
      const casinoMatch = casinoFilter === "all" || player.casino === casinoFilter;
      const statusMatch = statusFilter === "all" || getAccountStatus(player) === statusFilter.toLowerCase();
      
      const taskCount = player.tasks[0]?.count ?? 0;
      const callCount = player.tasks[0]?.call_count ?? 0;
      const hasBirthday = getBirthdayStatus(player.dob) !== null;
      const isToFollowUp = toFollowUpPlayerIdSet.has(player.id);
      
      // Apply task filter
      let taskFilterMatch = true;
      if (taskFilter === "with_tasks") {
        // Only non-call tasks
        taskFilterMatch = taskCount > 0;
      } else if (taskFilter === "with_calls") {
        taskFilterMatch = callCount > 0;
      } else if (taskFilter === "with_both") {
        // All tasks (calls + non-call tasks)
        taskFilterMatch = taskCount > 0 || callCount > 0;
      } else if (taskFilter === "with_birthdays") {
        taskFilterMatch = hasBirthday;
      } else if (taskFilter === "to_follow_up") {
        taskFilterMatch = isToFollowUp;
      }

      return taskFilterMatch && vipLevelMatch && casinoMatch && statusMatch && (
        player.user_id.toLowerCase().includes(lowerCaseFilter) ||
        getFullName(player).toLowerCase().includes(lowerCaseFilter) ||        (player.email || "").toLowerCase().includes(lowerCaseFilter) ||
        (player.phone || "").toLowerCase().includes(lowerCaseFilter) ||
        (player.casino || "").toLowerCase().includes(lowerCaseFilter)
      );
    });

    // Sort players with multi-level priority
    return filtered.sort((a, b) => {
      const aTaskCount = a.tasks[0]?.count ?? 0;
      const bTaskCount = b.tasks[0]?.count ?? 0;
      const aCallCount = a.tasks[0]?.call_count ?? 0;
      const bCallCount = b.tasks[0]?.call_count ?? 0;
      const aBirthday = getBirthdayStatus(a.dob);
      const bBirthday = getBirthdayStatus(b.dob);
      
      // Priority 1: Players with calls come first
      if (aCallCount > 0 && bCallCount === 0) return -1;
      if (aCallCount === 0 && bCallCount > 0) return 1;
      
      // Priority 2: Among players with calls OR both have no calls, check for tasks
      if (aTaskCount > 0 && bTaskCount === 0 && aCallCount === bCallCount) return -1;
      if (aTaskCount === 0 && bTaskCount > 0 && aCallCount === bCallCount) return 1;
      
      // Priority 3: Sort by earliest due date if both have tasks or calls
      if ((aCallCount > 0 || aTaskCount > 0) && (bCallCount > 0 || bTaskCount > 0)) {
        const aDate = a.earliest_task_due_date ? new Date(a.earliest_task_due_date).getTime() : Infinity;
        const bDate = b.earliest_task_due_date ? new Date(b.earliest_task_due_date).getTime() : Infinity;
        if (aDate !== bDate) return aDate - bDate;
      }
      
      // Priority 4: Players with birthdays come next (after those with tasks/calls)
      if (aBirthday !== null && bBirthday === null && aCallCount === 0 && bCallCount === 0 && aTaskCount === 0 && bTaskCount === 0) return -1;
      if (aBirthday === null && bBirthday !== null && aCallCount === 0 && bCallCount === 0 && aTaskCount === 0 && bTaskCount === 0) return 1;
      
      // If both have birthdays and tasks, already sorted by tasks above
      
      // Priority 5: Apply user-selected sort
      const aVal = sortField === 'task_count' ? aTaskCount : a[sortField as keyof PlayerWithTasks] as any;
      const bVal = sortField === 'task_count' ? bTaskCount : b[sortField as keyof PlayerWithTasks] as any;
      
      const order = sortDirection === "asc" ? 1 : -1;

      if (aVal === null || aVal === undefined) return order;
      if (bVal === null || bVal === undefined) return -order;

      if (typeof aVal === "string" && typeof bVal === "string") return aVal.localeCompare(bVal) * order;
      if (aVal < bVal) return -1 * order;
      if (aVal > bVal) return 1 * order;
      
      return 0;
    });
  }, [players, filter, vipFilter, casinoFilter, statusFilter, taskFilter, sortField, sortDirection, toFollowUpPlayerIdSet]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedPlayers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, filteredAndSortedPlayers.length);
  const paginatedPlayers = filteredAndSortedPlayers.slice(pageStart, pageEnd);

  const getRowHighlight = (player: PlayerWithTasks) => {
    const taskCount = player.tasks[0]?.count ?? 0;
    const callCount = player.tasks[0]?.call_count ?? 0;
    const followUpViewedAt = followUpViewedAtByPlayer[player.id];
    const monthlyCallCount = monthlyCallCountByPlayer[player.id] || 0;

    if (getAccountStatus(player) === "closed") {
      if (getClosureKind(player) === "temporary") {
        return "bg-blue-50/60 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/20 dark:ring-blue-900 hover:bg-blue-100/70 dark:hover:bg-blue-950/30";
      }

      return "bg-red-50/60 ring-1 ring-inset ring-red-200 dark:bg-red-950/20 dark:ring-red-900 hover:bg-red-100/70 dark:hover:bg-red-950/30";
    }

    if (player.bonus_abuser) {
      return "bg-red-50/70 ring-1 ring-inset ring-red-200 dark:bg-red-950/20 dark:ring-red-900 hover:bg-red-100/70 dark:hover:bg-red-950/30";
    }
    
    if (followUpViewedAt) {
      return "bg-green-50/70 ring-1 ring-inset ring-green-200 dark:bg-green-950/20 dark:ring-green-900 hover:bg-green-100/70 dark:hover:bg-green-950/30";
    }

    if (monthlyCallCount > 2) {
      return "bg-fuchsia-50/60 ring-1 ring-inset ring-fuchsia-200 dark:bg-fuchsia-950/20 dark:ring-fuchsia-900 hover:bg-fuchsia-100/70 dark:hover:bg-fuchsia-950/30";
    }
    
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
    <div className="flex h-full min-h-0 w-full flex-col text-sm">
      <div className="shrink-0 flex flex-wrap items-center gap-2 rounded-md border-2 border-border/70 bg-background/70 p-2 shadow-sm">
        <Input placeholder="Filter players..." value={filter} onChange={(e) => handleFilterChange(e.target.value)} className="h-8 max-w-[220px] text-xs" />
        <select value={vipFilter} onChange={(event) => handleVipFilterChange(event.target.value)} className={`${compactNativeSelect} w-[135px]`}>
          <option value="all">All VIP Levels</option>
            {(Object.entries(vipConfig) as [string, any][]).map(([level, config]) => (
              <option key={level} value={level}>{config.name}</option>
            ))}
        </select>
        
        <select value={casinoFilter} onChange={(event) => handleCasinoFilterChange(event.target.value)} className={`${compactNativeSelect} w-[135px]`}>
          <option value="all">All Casinos</option>
            {uniqueCasinos.length > 0 ? (
              uniqueCasinos.map((casino) => (
                <option key={casino} value={casino}>{casino}</option>
              ))
            ) : (
              <option value="none" disabled>No casinos yet</option>
            )}
        </select>

        <select value={statusFilter} onChange={(event) => handleStatusFilterChange(event.target.value)} className={`${compactNativeSelect} w-[140px]`}>
          <option value="all">All Statuses</option>
            {uniqueStatuses.map((status) => (
              <option key={status} value={status}>{formatStatus(status)}</option>
            ))}
        </select>
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-md border-2 border-border/70 shadow-sm">
        <Table className="text-xs">
          <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
            <TableRow>
              <SortableHeader field="user_id" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>User ID</SortableHeader>              <SortableHeader field="firstname" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Full Name</SortableHeader>
              <SortableHeader field="email" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Email</SortableHeader>
              <SortableHeader field="phone" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Phone</SortableHeader>
              <SortableHeader field="casino" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Casino</SortableHeader>
              <TableHead className="h-8 px-2 text-xs">Status</TableHead>
              <SortableHeader field="vip_level" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>VIP Level</SortableHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPlayers.length > 0 ? (
              paginatedPlayers.map((player) => (
                <TableRow
                  key={player.id}
                  className={`${getRowHighlight(player)} cursor-pointer`}
                  onClick={() => onOpenPlayer?.(player.id)}
                >
                  <TableCell className={compactCell}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{player.user_id}</span>
                      <CopyButton text={player.user_id} label="User ID" />
                    </div>
                  </TableCell>
                  <TableCell className={compactCell}>
                    <div className="flex items-center gap-2">
                      <span>{getFullName(player)}</span>
                      <CopyButton text={getFullName(player)} label="Name" />
                    </div>
                  </TableCell>
                  <TableCell className={compactCell}>
                    <div className="flex items-center gap-2">
                      <span>{player.email}</span>
                      <CopyButton text={player.email} label="Email" />
                    </div>
                  </TableCell>
                  <TableCell className={compactCell}>
                    {player.phone ? (
                      <div className="flex items-center gap-2">
                        <span>{player.phone}</span>
                        <CopyButton text={player.phone} label="Phone" />
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">Not provided</span>
                    )}
                  </TableCell>
                  <TableCell className={compactCell}>
                    {player.casino ? (
                      <span className="font-medium">{player.casino}</span>
                    ) : (
                      <span className="text-muted-foreground italic">Not specified</span>
                    )}
                  </TableCell>
                  <TableCell className={compactCell}>
                    <DirectoryBadgeTooltip label={getAccountStatus(player) === "closed" ? `${getClosureLabel(player)} account closure` : "Account is open"}>
                      <Badge
                        variant="outline"
                        className={`capitalize ${getStatusBadgeClass(getAccountStatus(player), player)}`}
                      >
                        {getAccountStatus(player) === "closed" ? getClosureLabel(player) : formatStatus(getAccountStatus(player))}
                      </Badge>
                    </DirectoryBadgeTooltip>
                  </TableCell>
                  <TableCell className={compactCell}>
                    <DirectoryBadgeTooltip label={`VIP level ${player.vip_level || 1}: ${vipConfig[(player.vip_level || 1) as VipLevel].name}`}>
                      <Badge
                        className={`${vipConfig[(player.vip_level || 1) as VipLevel].bgColor} ${vipConfig[(player.vip_level || 1) as VipLevel].color} hover:${vipConfig[(player.vip_level || 1) as VipLevel].bgColor}`}
                      >
                        {player.vip_level || 1} - {vipConfig[(player.vip_level || 1) as VipLevel].name}
                      </Badge>
                    </DirectoryBadgeTooltip>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={7} className="h-24 text-center">No players found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-x border-b px-3 py-2 text-xs text-muted-foreground">
        <div>
          Showing <span className="font-semibold text-foreground">{filteredAndSortedPlayers.length === 0 ? 0 : pageStart + 1}</span>
          {"-"}
          <span className="font-semibold text-foreground">{pageEnd}</span> of{" "}
          <span className="font-semibold text-foreground">{filteredAndSortedPlayers.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Rows</span>
          <select value={String(pageSize)} onChange={(event) => handlePageSizeChange(event.target.value)} className="h-7 w-[78px] rounded-md border border-input bg-background px-2 text-xs">
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
          <span className="min-w-16 text-center">
            Page {safeCurrentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={safeCurrentPage <= 1}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={safeCurrentPage >= totalPages}
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
