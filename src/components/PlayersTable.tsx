import { useState, useMemo } from "react";
import { PlayerWithTasks, VipLevel, getFullName, vipConfig } from "@/services/playerService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, ArrowUpDown, Trash2, Edit, Plus, Bell, ListPlus, Phone, Users, CalendarCheck, X, Star, ShieldAlert, Mail, Send } from "lucide-react";
import { differenceInCalendarDays, formatDistanceToNow } from "date-fns";
import { TaskCountBadge } from "./TaskCountBadge";
import { CopyButton } from "./CopyButton";
import { getBirthdayStatus, getBirthdayBadge } from "@/lib/utils";

type SortField = keyof PlayerWithTasks | "task_count";
type SortDirection = "asc" | "desc";
type TaskFilter = "all" | "with_tasks" | "with_calls" | "with_both" | "with_birthdays";

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
}

const compactCell = "px-2 py-1.5 align-middle";
const RECENT_CALL_BADGE_DAYS = 3;
const OVERDUE_CALL_BADGE_DAYS = 30;

function getCallAgeLabel(lastCallAt?: string | null) {
  if (!lastCallAt) return null;

  const callDate = new Date(lastCallAt);
  const dayDiff = differenceInCalendarDays(new Date(), callDate);

  if (!Number.isFinite(callDate.getTime()) || dayDiff < 0) {
    return null;
  }

  if (dayDiff === 0) return "today";
  if (dayDiff <= RECENT_CALL_BADGE_DAYS) {
    return `${dayDiff} day${dayDiff === 1 ? "" : "s"} ago`;
  }
  if (dayDiff > OVERDUE_CALL_BADGE_DAYS) {
    return formatDistanceToNow(callDate, { addSuffix: true });
  }

  return null;
}

function getLastCallBadgeClass(lastCallAt?: string | null) {
  if (!lastCallAt) {
    return "border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300";
  }

  const callDate = new Date(lastCallAt);
  if (!Number.isFinite(callDate.getTime())) {
    return "border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300";
  }

  const daysSinceCall = differenceInCalendarDays(new Date(), callDate);
  return daysSinceCall > OVERDUE_CALL_BADGE_DAYS
    ? "border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
    : "border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300";
}

function getClosureKind(player: PlayerWithTasks) {
  return player.account_closure_type === "break" ? "temporary" : "permanent";
}

function getClosureLabel(player: PlayerWithTasks) {
  return getClosureKind(player) === "temporary" ? "Temporary break" : "Permanent";
}

function getClosureMarkerClass(player: PlayerWithTasks) {
  return getClosureKind(player) === "temporary"
    ? "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
    : "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300";
}

const SortableHeader = ({ children, field, sortField, sortDirection, onSort }: { children: React.ReactNode; field: SortField; sortField: SortField; sortDirection: SortDirection; onSort: (field: SortField) => void; }) => {
  const isSorted = sortField === field;
  return (
    <TableHead onClick={() => onSort(field)} className="h-8 cursor-pointer px-2 text-xs hover:bg-muted/50">
      <div className="flex items-center gap-1.5">
        {children}
        <ArrowUpDown className={`h-3.5 w-3.5 ${isSorted ? "" : "text-muted-foreground"}`} />
      </div>
    </TableHead>
  );
};

export function PlayersTable({ players, onEdit, onDelete, onAddTask, onAddFollowUp, onOpenPlayer, followUpViewedAtByPlayer = {}, lastCallAtByPlayer = {}, monthlyCallCountByPlayer = {} }: PlayersTableProps) {
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filter, setFilter] = useState("");
  const [vipFilter, setVipFilter] = useState<string>("all");
  const [casinoFilter, setCasinoFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
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

  const handleTaskFilterChange = (value: TaskFilter) => {
    setTaskFilter(value);
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
  const isClosedAccount = (player: PlayerWithTasks) => getAccountStatus(player) === "closed";

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    players.forEach((player) => statuses.add(getAccountStatus(player)));
    return Array.from(statuses).sort();
  }, [players]);

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
      }

      return taskFilterMatch && vipLevelMatch && casinoMatch && statusMatch && (
        player.user_id.toLowerCase().includes(lowerCaseFilter) ||
        getFullName(player).toLowerCase().includes(lowerCaseFilter) ||
        player.username.toLowerCase().includes(lowerCaseFilter) ||
        (player.email || "").toLowerCase().includes(lowerCaseFilter) ||
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
  }, [players, filter, vipFilter, casinoFilter, statusFilter, taskFilter, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedPlayers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, filteredAndSortedPlayers.length);
  const paginatedPlayers = filteredAndSortedPlayers.slice(pageStart, pageEnd);

  const getTaskIndicators = (player: PlayerWithTasks) => {
    const taskCount = player.tasks[0]?.count ?? 0;
    const callCount = player.tasks[0]?.call_count ?? 0;
    const birthdayStatus = getBirthdayStatus(player.dob);
    const birthdayBadge = getBirthdayBadge(birthdayStatus);
    const followUpViewedAt = isClosedAccount(player) ? null : followUpViewedAtByPlayer[player.id];
    const lastCallAt = lastCallAtByPlayer[player.id];
    const callAgeLabel = getCallAgeLabel(lastCallAt);
    const monthlyCallCount = monthlyCallCountByPlayer[player.id] || 0;
    
    return (
      <div className="flex items-center gap-1.5">
        {getAccountStatus(player) === "closed" && (
          <div
            className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${getClosureMarkerClass(player)}`}
            title={`${getClosureLabel(player)} closure${player.account_closure_reason ? `: ${player.account_closure_reason}` : ""}`}
          >
            <X className="h-3 w-3" />
            <span className="text-[11px] font-semibold">{getClosureLabel(player)}</span>
          </div>
        )}
        {player.bonus_abuser && (
          <div
            className="flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-1.5 py-0.5 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
            title="Marked as bonus abuser"
          >
            <ShieldAlert className="h-3 w-3" />
            <span className="text-[11px] font-semibold">Bonus abuser</span>
          </div>
        )}
        {player.contact_email_only && (
          <div
            className="flex items-center gap-1 rounded-full border border-orange-300 bg-orange-100 px-1.5 py-0.5 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
            title="Prefers exclusive email contact"
          >
            <Mail className="h-3 w-3" />
            <span className="text-[11px] font-semibold">Email only</span>
          </div>
        )}
        {player.telegram_member && (
          <div
            className="flex items-center gap-1 rounded-full border border-sky-300 bg-sky-100 px-1.5 py-0.5 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
            title="Telegram group member"
          >
            <Send className="h-3 w-3" />
            <span className="text-[11px] font-semibold">Telegram</span>
          </div>
        )}
        {birthdayBadge && (
          <div className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] ${birthdayBadge.className}`}>
            <span className="text-[10px] leading-none">{birthdayBadge.emoji}</span>
            <span className="font-semibold leading-none">{birthdayBadge.text}</span>
          </div>
        )}
        {taskCount > 0 && (
          <div className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 dark:border-amber-700 dark:bg-amber-900/30">
            <Bell className="w-3 h-3 text-amber-700 dark:text-amber-300" />
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">{taskCount}</span>
          </div>
        )}
        {callCount > 0 && (
          <div className="flex items-center gap-1 rounded-full border border-blue-300 bg-blue-100 px-1.5 py-0.5 dark:border-blue-700 dark:bg-blue-900/30">
            <Phone className="w-3 h-3 text-blue-700 dark:text-blue-300" />
            <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">{callCount}</span>
          </div>
        )}
        {callAgeLabel && lastCallAt && (
          <div
            className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${getLastCallBadgeClass(lastCallAt)}`}
            title={`Last called ${formatDistanceToNow(new Date(lastCallAt), { addSuffix: true })}`}
          >
            <Phone className="h-3 w-3" />
            <span className="text-[11px] font-semibold">{callAgeLabel}</span>
          </div>
        )}
        {monthlyCallCount > 2 && (
          <div
            className="flex items-center gap-1 rounded-full border border-fuchsia-300 bg-fuchsia-100 px-1.5 py-0.5 dark:border-fuchsia-800 dark:bg-fuchsia-950/40"
            title={`${monthlyCallCount} calls logged this month`}
          >
            <Star className="h-3 w-3 text-fuchsia-700 dark:text-fuchsia-300" />
            <span className="text-[11px] font-semibold text-fuchsia-700 dark:text-fuchsia-300">Most contacted</span>
          </div>
        )}
        {followUpViewedAt && (
          <div
            className="flex items-center gap-1 rounded-full border border-green-300 bg-green-100 px-1.5 py-0.5 dark:border-green-800 dark:bg-green-950/40"
            title={`Followed up ${formatDistanceToNow(new Date(followUpViewedAt), { addSuffix: true })}`}
          >
            <CalendarCheck className="h-3 w-3 text-green-700 dark:text-green-300" />
            <span className="text-[11px] font-semibold text-green-700 dark:text-green-300">Followed up</span>
          </div>
        )}
      </div>
    );
  };

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
        <Select value={vipFilter} onValueChange={handleVipFilterChange}>
          <SelectTrigger className="h-8 w-[135px] text-xs"><SelectValue placeholder="Filter by VIP" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All VIP Levels</SelectItem>
            {(Object.entries(vipConfig) as [string, any][]).map(([level, config]) => (
              <SelectItem key={level} value={level}>{config.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={casinoFilter} onValueChange={handleCasinoFilterChange}>
          <SelectTrigger className="h-8 w-[135px] text-xs"><SelectValue placeholder="Filter by Casino" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Casinos</SelectItem>
            {uniqueCasinos.length > 0 ? (
              uniqueCasinos.map((casino) => (
                <SelectItem key={casino} value={casino}>{casino}</SelectItem>
              ))
            ) : (
              <SelectItem value="none" disabled>No casinos yet</SelectItem>
            )}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Filter by Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {uniqueStatuses.map((status) => (
              <SelectItem key={status} value={status}>{formatStatus(status)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <div className="flex items-center gap-1 rounded-md border-2 border-border/70 bg-muted/30 p-0.5 shadow-sm">
          <Button
            variant={taskFilter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleTaskFilterChange("all")}
            className="h-7 gap-1 px-2 text-xs"
          >
            <Users className="h-3.5 w-3.5" />
            All
          </Button>
          <Button
            variant={taskFilter === "with_tasks" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleTaskFilterChange("with_tasks")}
            className="h-7 gap-1 px-2 text-xs"
          >
            <Bell className="h-3.5 w-3.5" />
            Tasks
          </Button>
          <Button
            variant={taskFilter === "with_calls" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleTaskFilterChange("with_calls")}
            className="h-7 gap-1 px-2 text-xs"
          >
            <Phone className="h-3.5 w-3.5" />
            Calls
          </Button>
          <Button
            variant={taskFilter === "with_both" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleTaskFilterChange("with_both")}
            className="h-7 gap-1 px-2 text-xs text-purple-700 dark:text-purple-300"
          >
            <Bell className="w-3.5 h-3.5" />
            <Phone className="w-3.5 h-3.5" />
            Reminders
          </Button>
          <Button
            variant={taskFilter === "with_birthdays" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleTaskFilterChange("with_birthdays")}
            className="h-7 gap-1 px-2 text-xs text-pink-700 dark:text-pink-300"
          >
            🎂
            Birthdays
          </Button>
        </div>
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-md border-2 border-border/70 shadow-sm">
        <Table className="text-xs">
          <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
            <TableRow>
              <SortableHeader field="user_id" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>User ID</SortableHeader>
              <SortableHeader field="username" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Username</SortableHeader>
              <SortableHeader field="firstname" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Full Name</SortableHeader>
              <SortableHeader field="email" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Email</SortableHeader>
              <SortableHeader field="phone" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Phone</SortableHeader>
              <SortableHeader field="casino" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Casino</SortableHeader>
              <TableHead className="h-8 px-2 text-xs">Status</TableHead>
              <SortableHeader field="vip_level" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>VIP Level</SortableHeader>
              <SortableHeader field="task_count" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Tasks</SortableHeader>
              <TableHead className="h-8 px-2 text-xs">Reminders</TableHead>
              <TableHead className="h-8 px-2 text-xs">Actions</TableHead>
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
                  <TableCell className={`${compactCell} font-medium`}>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenPlayer?.(player.id);
                        }}
                        className="text-left text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {player.username}
                      </button>
                      <CopyButton text={player.username} label="Username" />
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
                    <Badge variant="outline" className={`capitalize ${getStatusBadgeClass(getAccountStatus(player), player)}`}>
                      {getAccountStatus(player) === "closed" ? getClosureLabel(player) : formatStatus(getAccountStatus(player))}
                    </Badge>
                  </TableCell>
                  <TableCell className={compactCell}>
                    <Badge className={`${vipConfig[(player.vip_level || 1) as VipLevel].bgColor} ${vipConfig[(player.vip_level || 1) as VipLevel].color} px-1.5 py-0 text-[11px] hover:${vipConfig[(player.vip_level || 1) as VipLevel].bgColor}`}>
                      {player.vip_level || 1} - {vipConfig[(player.vip_level || 1) as VipLevel].name}
                    </Badge>
                  </TableCell>
                  <TableCell className={compactCell}><TaskCountBadge count={player.tasks[0]?.count ?? 0} /></TableCell>
                  <TableCell className={compactCell}>{getTaskIndicators(player)}</TableCell>
                  <TableCell className={compactCell}>
                    <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                      {onAddTask && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => onAddTask(player.id)}
                          title="Add task for this player"
                          className="h-7 w-7 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                        >
                          <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </Button>
                      )}
                      {onAddFollowUp && !isClosedAccount(player) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onAddFollowUp(player)}
                          title="Add to Queue"
                          className="h-7 w-7 hover:bg-primary/10"
                        >
                          <ListPlus className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(player)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(player.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={11} className="h-24 text-center">No players found.</TableCell></TableRow>
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
          <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="h-7 w-[78px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
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
