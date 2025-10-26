import { useState } from "react";
import Link from "next/link";
import { Player, getFullName, VipLevel, vipTierName } from "@/types/player";
import { taskService } from "@/services/taskService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Search, ArrowUpDown, ExternalLink, AlertCircle } from "lucide-react";

interface PlayersTableProps {
  players: Player[];
  onEdit: (player: Player) => void;
  onDelete: (id: string) => void;
}

type SortField = keyof Player | "name";
type SortDirection = "asc" | "desc";

export function PlayersTable({ players, onEdit, onDelete }: PlayersTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredPlayers = players.filter((player) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      player.userId.toLowerCase().includes(searchLower) ||
      player.username.toLowerCase().includes(searchLower) ||
      getFullName(player).toLowerCase().includes(searchLower) ||
      player.email.toLowerCase().includes(searchLower) ||
      player.casino.toLowerCase().includes(searchLower)
    );
  });

  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    if (sortField === "name") {
      aValue = getFullName(a);
      bValue = getFullName(b);
    } else {
      aValue = a[sortField];
      bValue = b[sortField];
    }

    if (aValue === null) return 1;
    if (bValue === null) return -1;

    if (typeof aValue === "string") {
      return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }

    if (typeof aValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });

  const getVipBadgeColor = (level: VipLevel) => {
    const colors: Record<VipLevel, string> = {
      1: "bg-amber-700 hover:bg-amber-700 text-white",
      2: "bg-slate-400 hover:bg-slate-400 text-white",
      3: "bg-yellow-500 hover:bg-yellow-500 text-slate-900",
      4: "bg-slate-700 hover:bg-slate-700 text-white",
      5: "bg-cyan-500 hover:bg-cyan-500 text-slate-900",
    };
    return colors[level];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search by User ID, Username, Name, Email, or Casino..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-900">
                <TableHead className="w-[100px]">
                  <Button variant="ghost" size="sm" onClick={() => handleSort("userId")} className="h-8 font-semibold">
                    User ID
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort("username")} className="h-8 font-semibold">
                    Username
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort("name")} className="h-8 font-semibold">
                    Name
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort("email")} className="h-8 font-semibold">
                    Email
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort("casino")} className="h-8 font-semibold">
                    Casino
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort("vipLevel")} className="h-8 font-semibold">
                    VIP Level
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleSort("totalDeposits")} className="h-8 font-semibold">
                    Total Deposits
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort("lastEmailSent")} className="h-8 font-semibold">
                    Last Email
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-center">
                  <span className="font-semibold">Tasks</span>
                </TableHead>
                <TableHead className="text-right w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPlayers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                    No players found
                  </TableCell>
                </TableRow>
              ) : (
                sortedPlayers.map((player) => {
                  const taskCount = taskService.getTaskCountByPlayerId(player.id);
                  return (
                    <TableRow key={player.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <TableCell className="font-mono text-sm">{player.userId}</TableCell>
                      <TableCell className="font-medium">{player.username}</TableCell>
                      <TableCell>
                        <Link href={`/player/${player.id}`} className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline">
                          {getFullName(player)}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400">{player.email}</TableCell>
                      <TableCell>{player.casino}</TableCell>
                      <TableCell>
                        <Badge title={vipTierName[player.vipLevel]} className={getVipBadgeColor(player.vipLevel)}>
                          {player.vipLevel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(player.totalDeposits)}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(player.lastEmailSent)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {taskCount.pending > 0 && (
                            <>
                              <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                              <span className="font-semibold text-orange-600 dark:text-orange-400">
                                {taskCount.pending}
                              </span>
                            </>
                          )}
                          {taskCount.pending === 0 && taskCount.total > 0 && (
                            <span className="text-slate-400 dark:text-slate-600">✓</span>
                          )}
                          {taskCount.total === 0 && (
                            <span className="text-slate-300 dark:text-slate-700">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(player)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(player.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
