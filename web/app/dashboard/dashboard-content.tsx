"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Mail,
  Eye,
  BarChart3,
  LogOut,
  RefreshCw,
  Send,
  Clock,
  TrendingUp,
  Search,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import Link from "next/link";

const POLL_INTERVAL = 10_000; // 10 seconds

interface TrackedEmail {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  openCount: number;
  lastOpened: string | null;
  createdAt: string;
}

interface DashboardUser {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export function DashboardContent({ user }: { user: DashboardUser }) {
  const [emails, setEmails] = useState<TrackedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLive, setIsLive] = useState(true);

  // Ref to hold the latest emails for comparison in the polling interval
  const emailsRef = useRef<TrackedEmail[]>([]);
  const isFirstFetch = useRef(true);

  // Keep ref in sync
  useEffect(() => {
    emailsRef.current = emails;
  }, [emails]);

  // Initial fetch (with loading skeleton)
  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/emails");
      if (res.ok) {
        const data = await res.json();
        setEmails(data);
        isFirstFetch.current = false;
      }
    } catch (error) {
      console.error("Failed to fetch emails:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // Auto-polling: silently fetch and show toasts on new opens
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/emails");
        if (!res.ok) return;

        const data: TrackedEmail[] = await res.json();
        const prev = emailsRef.current;

        // Skip comparison on first load
        if (prev.length > 0) {
          // Detect new opens
          for (const newEmail of data) {
            const old = prev.find((e) => e.id === newEmail.id);
            if (old && newEmail.openCount > old.openCount) {
              const newOpens = newEmail.openCount - old.openCount;
              toast.success(
                `${newEmail.recipient} opened your email`,
                {
                  description: `"${newEmail.subject}" — ${newOpens} new open${newOpens > 1 ? "s" : ""} (total: ${newEmail.openCount})`,
                  duration: 6000,
                }
              );
            }
          }

          // Detect newly tracked emails
          for (const newEmail of data) {
            const exists = prev.find((e) => e.id === newEmail.id);
            if (!exists) {
              toast.info("New tracked email", {
                description: `"${newEmail.subject}" to ${newEmail.recipient}`,
                duration: 4000,
              });
            }
          }
        }

        setEmails(data);
      } catch {
        // Silently fail background polls
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [isLive]);

  const filteredEmails = emails.filter(
    (email) =>
      email.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalOpens = emails.reduce((sum, e) => sum + e.openCount, 0);
  const openedEmails = emails.filter((e) => e.openCount > 0).length;
  const openRate =
    emails.length > 0
      ? ((openedEmails / emails.length) * 100).toFixed(1)
      : "0";

  function formatTimeAgo(dateString: string | null) {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-amber-50/30">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-orange-100/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <Mail className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                Trackio
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.image || ""} alt={user.name || ""} />
                  <AvatarFallback className="bg-gradient-to-br from-orange-400 to-amber-400 text-white text-xs">
                    {user.name?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{user.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-gray-500 hover:text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
            Welcome back,{" "}
            <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
              {user.name?.split(" ")[0] || "there"}
            </span>
          </h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
            <p className="text-sm sm:text-base text-gray-500">
              Here&apos;s an overview of your email tracking activity.
            </p>
            <button
              onClick={() => setIsLive((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                isLive
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                  : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100"
              }`}
              title={isLive ? "Real-time updates active — click to pause" : "Updates paused — click to resume"}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLive ? "bg-emerald-500 animate-pulse" : "bg-gray-400"
                }`}
              />
              {isLive ? "Live" : "Paused"}
            </button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {[
            {
              title: "Total Tracked",
              value: emails.length.toString(),
              icon: Send,
              gradient: "from-orange-500 to-rose-500",
              bg: "from-orange-50 to-rose-50",
            },
            {
              title: "Total Opens",
              value: totalOpens.toString(),
              icon: Eye,
              gradient: "from-amber-500 to-orange-500",
              bg: "from-amber-50 to-orange-50",
            },
            {
              title: "Open Rate",
              value: `${openRate}%`,
              icon: TrendingUp,
              gradient: "from-yellow-500 to-amber-500",
              bg: "from-yellow-50 to-amber-50",
            },
            {
              title: "Opened Emails",
              value: openedEmails.toString(),
              icon: BarChart3,
              gradient: "from-orange-500 to-amber-500",
              bg: "from-orange-50 to-amber-50",
            },
          ].map((stat, i) => (
            <Card
              key={i}
              className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white"
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat.title}</p>
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
                      {loading ? (
                        <span className="inline-block w-16 h-8 bg-gray-100 rounded animate-pulse" />
                      ) : (
                        stat.value
                      )}
                    </p>
                  </div>
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.bg} flex items-center justify-center`}
                  >
                    <stat.icon className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Email Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl text-gray-900">
                    Tracked Emails
                  </CardTitle>
                  <CardDescription>
                    All emails being tracked by Trackio
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search emails..."
                      className="pl-9 w-full sm:w-64 border-gray-200 focus:border-orange-300 focus:ring-orange-200"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchEmails}
                    className="border-orange-200 text-orange-600 hover:bg-orange-50 flex-shrink-0"
                  >
                    <RefreshCw
                      className={`w-4 h-4 sm:mr-1 ${
                        loading ? "animate-spin" : ""
                      }`}
                    />
                    <span className="hidden sm:inline">Refresh</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4 py-8">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 animate-pulse"
                    >
                      <div className="w-10 h-10 bg-gray-100 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="w-1/3 h-4 bg-gray-100 rounded" />
                        <div className="w-1/4 h-3 bg-gray-100 rounded" />
                      </div>
                      <div className="w-16 h-6 bg-gray-100 rounded" />
                    </div>
                  ))}
                </div>
              ) : filteredEmails.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-orange-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700">
                    {searchQuery ? "No matching emails" : "No tracked emails yet"}
                  </h3>
                  <p className="text-gray-400 mt-1 text-sm max-w-sm mx-auto">
                    {searchQuery
                      ? "Try adjusting your search query."
                      : "Send your first tracked email using the Trackio Chrome extension to see it here."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-gray-100">
                        <TableHead className="text-gray-500 font-medium">
                          Recipient
                        </TableHead>
                        <TableHead className="text-gray-500 font-medium hidden sm:table-cell">
                          Subject
                        </TableHead>
                        <TableHead className="text-gray-500 font-medium text-center">
                          Status
                        </TableHead>
                        <TableHead className="text-gray-500 font-medium text-center">
                          Opens
                        </TableHead>
                        <TableHead className="text-gray-500 font-medium hidden md:table-cell">
                          Last Opened
                        </TableHead>
                        <TableHead className="text-gray-500 font-medium hidden lg:table-cell">
                          Sent
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {filteredEmails.map((email, i) => (
                          <motion.tr
                            key={email.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="border-gray-50 hover:bg-orange-50/30 transition-colors group"
                          >
                            <TableCell>
                              <div className="flex items-center gap-2 sm:gap-3">
                                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white text-xs sm:text-sm font-bold flex-shrink-0">
                                  {email.recipient
                                    .charAt(0)
                                    .toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <span className="text-xs sm:text-sm font-medium text-gray-700 truncate block max-w-[120px] sm:max-w-[200px]">
                                    {email.recipient}
                                  </span>
                                  <span className="text-[10px] sm:hidden text-gray-400 truncate block max-w-[120px]">
                                    {email.subject}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <span className="text-sm text-gray-600 truncate max-w-[250px] block">
                                {email.subject}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {email.openCount > 0 ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                                  <Eye className="w-3 h-3 mr-1" />
                                  Opened
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="bg-gray-50 text-gray-500 border-gray-200"
                                >
                                  <Send className="w-3 h-3 mr-1" />
                                  Sent
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={`text-sm font-semibold ${
                                  email.openCount > 0
                                    ? "text-orange-600"
                                    : "text-gray-400"
                                }`}
                              >
                                {email.openCount}
                              </span>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                                <Clock className="w-3.5 h-3.5" />
                                {formatTimeAgo(email.lastOpened)}
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <span className="text-sm text-gray-400">
                                {formatTimeAgo(email.createdAt)}
                              </span>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

      </main>
    </div>
  );
}
