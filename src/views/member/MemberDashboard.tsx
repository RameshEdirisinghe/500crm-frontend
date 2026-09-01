import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Contact, CallLog, Order, User, TeamSalesTarget, TeamTargetTier } from '../../models/domain';
import { contactRepository, callLogRepository, orderRepository, userRepository, salesTargetRepository } from '../../repositories';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/shared/StatCard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { PostCallModal } from '../../components/calling/PostCallModal';
import { LoadingState } from '../../components/shared/LoadingState';
import { 
  PhoneCall, 
  CheckCircle2, 
  Trophy, 
  Phone, 
  ArrowRight, 
  Star, 
  TrendingUp, 
  DollarSign, 
  Award, 
  Calendar,
  Gift,
  Zap,
  Sparkles,
  Target
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Leaderboard } from '../../components/leaderboard';
import { formatCurrency } from '../../utils/currency';
import { 
  format, 
  isWithinInterval, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  subDays 
} from 'date-fns';

export type DashboardDateFilter = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_6_MONTHS' | 'CUSTOM';

interface LeaderboardMember {
  user: User;
  totalOrders: number;
  deliveredCount: number;
  rank: number;
}

export const MemberDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [salesTargets, setSalesTargets] = useState<TeamSalesTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Date Filter State for Top KPI Cards (matching supervisor dashboard)
  const [dateFilter, setDateFilter] = useState<DashboardDateFilter>('THIS_MONTH');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Month selector for sales goal & incentive
  const [selectedMonthPreset, setSelectedMonthPreset] = useState<'THIS_MONTH' | 'LAST_MONTH'>('THIS_MONTH');

  const [leaderboard, setLeaderboard] = useState<LeaderboardMember[]>([]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const currentTeamId = user.teamId;
      if (!currentTeamId) {
        setContacts([]);
        setCallLogs([]);
        setOrders([]);
        setSalesTargets([]);
        setLeaderboard([]);
        return;
      }
      const now = new Date();
      const targetYear = now.getFullYear();
      const targetMonthIndex = selectedMonthPreset === 'THIS_MONTH' ? now.getMonth() : now.getMonth() - 1;
      const targetMonthPrefix = `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}`;

      const [mContacts, mLogs, mOrders, allUsers, teamOrders, fetchedTargets] = await Promise.all([
        contactRepository.getByMemberId(user.id).catch(() => []),
        callLogRepository.getByMemberId(user.id).catch(() => []),
        orderRepository.getByMemberId(user.id).catch(() => []),
        userRepository.getAll().catch(() => []),
        orderRepository.getByTeamId(currentTeamId).catch(() => []),
        salesTargetRepository.getAll(targetMonthPrefix, currentTeamId).catch(() => []),
      ]);

      setContacts(mContacts);
      setCallLogs(mLogs);
      setOrders(mOrders);
      setSalesTargets(fetchedTargets);

      // Build Leaderboard Roster ranked by Delivered Orders (1.2)
      const membersOnly = allUsers.filter(
        (u) => u.role === 'TEAM_MEMBER' && u.teamId === currentTeamId
      );

      const computedRoster: LeaderboardMember[] = membersOnly.slice(0, 7).map((u) => {
        const uOrders = teamOrders.filter((o) => o.teamMemberId === u.id);
        const deliveredCount = uOrders.filter((o) => o.status === 'DELIVERED').length;
        const totalOrders = uOrders.length;

        return {
          user: u,
          totalOrders,
          deliveredCount,
          rank: 0,
        };
      });

      computedRoster.sort((a, b) => b.deliveredCount - a.deliveredCount || b.totalOrders - a.totalOrders);
      computedRoster.forEach((m, idx) => {
        m.rank = idx + 1;
      });

      setLeaderboard(computedRoster);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, selectedMonthPreset]);

  // Date Range Matcher Helper for Top Cards
  const isDateInFilter = (dateStr?: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();

    if (dateFilter === 'TODAY') {
      return isWithinInterval(date, { start: startOfDay(now), end: endOfDay(now) });
    }
    if (dateFilter === 'THIS_WEEK') {
      return isWithinInterval(date, { start: startOfWeek(now), end: endOfWeek(now) });
    }
    if (dateFilter === 'THIS_MONTH') {
      return isWithinInterval(date, { start: startOfMonth(now), end: endOfMonth(now) });
    }
    if (dateFilter === 'LAST_MONTH') {
      const lastMonth = subMonths(now, 1);
      return isWithinInterval(date, { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) });
    }
    if (dateFilter === 'LAST_6_MONTHS') {
      const sixMonthsAgo = subMonths(now, 6);
      return date >= sixMonthsAgo && date <= now;
    }
    if (dateFilter === 'CUSTOM') {
      const s = new Date(startDate);
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      return date >= s && date <= e;
    }
    return true;
  };

  // Scoped Data for Top Metric Cards
  const scopedCalls = useMemo(
    () => callLogs.filter((cl) => isDateInFilter(cl.calledAt || (cl as any).createdAt)),
    [callLogs, dateFilter, startDate, endDate]
  );
  const scopedContacts = useMemo(
    () => contacts.filter((c) => isDateInFilter(c.allocatedAt || c.importedAt || c.updatedAt)),
    [contacts, dateFilter, startDate, endDate]
  );
  const scopedInterestedContacts = useMemo(
    () => contacts.filter((c) => c.status === 'INTERESTED' && isDateInFilter(c.updatedAt || c.lastCalledAt || c.importedAt)),
    [contacts, dateFilter, startDate, endDate]
  );
  const scopedDeliveredOrders = useMemo(
    () => orders.filter((o) => o.status === 'DELIVERED' && isDateInFilter(o.deliveredAt || o.updatedAt || o.createdAt)),
    [orders, dateFilter, startDate, endDate]
  );

  if (loading) return <LoadingState rows={6} />;

  const scopedAssignedCount = dateFilter === 'THIS_MONTH' ? contacts.length : (scopedContacts.length || contacts.length);
  const scopedCompletedCallsCount = scopedCalls.length || contacts.filter((c) => c.status !== 'NEW').length;
  const scopedRemainingCount = Math.max(0, scopedAssignedCount - scopedCompletedCallsCount);
  const scopedCompletionPercentage = scopedAssignedCount > 0 ? Math.min(100, Math.round((scopedCompletedCallsCount / scopedAssignedCount) * 100)) : 0;

  // Dynamic Sales Goal & Allowance calculation
  const currentTeamId = user?.teamId || '';
  const activeTarget = salesTargets.find((t) => t.teamId === currentTeamId) || salesTargets[0];
  const targetGoal = activeTarget ? activeTarget.targetAmount : 500000;
  const activeTiers = activeTarget?.tiers && activeTarget.tiers.length > 0 ? activeTarget.tiers : [
    { minPercentage: 80, allowanceAmount: 10000, title: '80% Tier Allowance' },
    { minPercentage: 100, allowanceAmount: 20000, title: '100% Target Achieved Allowance' },
    { minPercentage: 120, allowanceAmount: 35000, title: '120% Super Achiever Incentive' },
  ];

  const now = new Date();
  const targetYear = now.getFullYear();
  const targetMonthIndex = selectedMonthPreset === 'THIS_MONTH' ? now.getMonth() : now.getMonth() - 1;
  const targetMonthPrefix = `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}`;

  const monthlyDeliveredOrders = orders.filter((o) => {
    if (o.status !== 'DELIVERED') return false;
    const dateStr = o.deliveredAt || o.createdAt;
    return dateStr.startsWith(targetMonthPrefix);
  });

  // Calculate personal delivered sales
  const memberBreakdown = activeTarget?.memberBreakdowns?.find((m) => m.id === user?.id);
  const currentSalesAmount = memberBreakdown
    ? memberBreakdown.actualSales
    : monthlyDeliveredOrders.reduce((sum, o) => sum + (o.codAmount || o.totalAmount || 0), 0);

  const achievementPercentage = targetGoal > 0 ? (currentSalesAmount / targetGoal) * 100 : 0;
  const achievementProgressClamped = Math.min(100, achievementPercentage);

  // Determine highest achieved tier for this member
  const sortedTiers = [...activeTiers].sort((a, b) => b.minPercentage - a.minPercentage);
  const unlockedTier = sortedTiers.find((t) => achievementPercentage >= t.minPercentage) || null;
  const earnedAllowance = unlockedTier ? unlockedTier.allowanceAmount : 0;

  // Next milestone calculation
  const ascendingTiers = [...activeTiers].sort((a, b) => a.minPercentage - b.minPercentage);
  const nextTier = ascendingTiers.find((t) => achievementPercentage < t.minPercentage) || null;
  const nextTierDeficit = nextTier ? Math.max(0, (targetGoal * (nextTier.minPercentage / 100)) - currentSalesAmount) : 0;

  // Filter first 3 priority follow-up numbers
  const followUpContacts = contacts
    .filter((c) => c.status !== 'NEW' && (c.isFollowUp || c.status === 'NOT_ANSWERED' || c.status === 'PHONE_OFF'))
    .slice(0, 3);

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Good morning, ${user?.fullName.split(' ')[0]} 👋`}
        description="Here is your monthly calling queue, personal sales goal achievement, and performance leaderboard."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              leftIcon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
              onClick={() => navigate('/member/sales')}
            >
              My Sales
            </Button>
            <Button
              variant="primary"
              leftIcon={<PhoneCall className="w-4 h-4" />}
              onClick={() => navigate('/member/contacts')}
            >
              Start Calling
            </Button>
          </div>
        }
      />

      {/* Date Range Selector Toolbar (Matching Supervisor Dashboard) */}
      <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-xs text-slate-800 uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Dashboard Date Scoping Filter</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: 'TODAY', label: 'Today' },
              { key: 'THIS_WEEK', label: 'This Week' },
              { key: 'THIS_MONTH', label: 'This Month' },
              { key: 'LAST_MONTH', label: 'Last Month' },
              { key: 'LAST_6_MONTHS', label: 'Last 6 Months' },
              { key: 'CUSTOM', label: 'Custom' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setDateFilter(item.key as DashboardDateFilter)}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  dateFilter === item.key
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {dateFilter === 'CUSTOM' && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 max-w-md">
            <Input
              type="date"
              label="Start Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              type="date"
              label="End Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* KPI Cards Scoped to Date Filter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          title="Assigned Calls"
          value={scopedAssignedCount}
          subtitle={`${scopedRemainingCount} remaining`}
          icon={<Phone className="w-4 h-4 text-blue-600" />}
          accentColor="blue"
        />
        <StatCard
          title="Calls Handled"
          value={scopedCompletedCallsCount}
          subtitle={`${scopedCompletionPercentage}% completed`}
          icon={<PhoneCall className="w-4 h-4 text-emerald-600" />}
          accentColor="green"
          trend={{ value: `${scopedCompletionPercentage}%`, isPositive: scopedCompletionPercentage >= 50 }}
        />
        <StatCard
          title="Interested Leads"
          value={scopedInterestedContacts.length}
          subtitle="Converted to CRM leads"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          accentColor="green"
        />
        <StatCard
          title="Delivered Orders"
          value={scopedDeliveredOrders.length}
          subtitle="Fulfilled shipments"
          icon={<Trophy className="w-4 h-4 text-purple-600" />}
          accentColor="purple"
        />
      </div>

      {/* Sleek, Non-Cluttered Sales Goal & Allowance Widget */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5">
        {/* Top Header: Title & Month Switcher */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-2xs shrink-0">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">
                Monthly Sales Goal &amp; Allowance
              </h3>
              <p className="text-[11px] text-slate-400 font-sans">
                Goal: <strong className="font-mono text-slate-700">{formatCurrency(targetGoal)}</strong> / month
              </p>
            </div>
          </div>

          {/* Month Switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold shrink-0 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setSelectedMonthPreset('THIS_MONTH')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-[11px] sm:text-xs ${
                selectedMonthPreset === 'THIS_MONTH'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {format(now, 'MMM yyyy')}
            </button>
            <button
              type="button"
              onClick={() => setSelectedMonthPreset('LAST_MONTH')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-[11px] sm:text-xs ${
                selectedMonthPreset === 'LAST_MONTH'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Last Month
            </button>
          </div>
        </div>

        {/* Sales Numbers & Two Dedicated Metric Cards */}
        <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-3.5 space-y-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">
                Personal Delivered Sales
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {formatCurrency(currentSalesAmount)}
                </span>
                <span className="text-xs font-medium text-slate-400 font-mono">
                  / {formatCurrency(targetGoal)} goal
                </span>
              </div>
            </div>

            {/* Two Dedicated Cards for Percentage and Allowance */}
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5 shrink-0">
              {/* Card 1: Goal Achievement % */}
              <div
                className={`p-2.5 sm:px-3 sm:py-2 rounded-xl border flex flex-col justify-center transition-all ${
                  achievementPercentage >= 100
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-2xs'
                    : achievementPercentage >= 80
                    ? 'bg-blue-50 border-blue-300 text-blue-950 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-900'
                }`}
              >
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Goal Progress
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {achievementPercentage >= 100 ? (
                    <Trophy className="w-4 h-4 text-emerald-600" />
                  ) : achievementPercentage >= 80 ? (
                    <Zap className="w-4 h-4 text-blue-600" />
                  ) : (
                    <TrendingUp className="w-4 h-4 text-slate-500" />
                  )}
                  <span
                    className={`font-mono text-base sm:text-lg font-extrabold ${
                      achievementPercentage >= 100
                        ? 'text-emerald-700'
                        : achievementPercentage >= 80
                        ? 'text-blue-700'
                        : 'text-slate-800'
                    }`}
                  >
                    {achievementPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Card 2: Earned Allowance */}
              <div
                className={`p-2.5 sm:px-3 sm:py-2 rounded-xl border flex flex-col justify-center transition-all ${
                  earnedAllowance > 0
                    ? 'bg-amber-50/80 border-amber-300 text-amber-950 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-900'
                }`}
              >
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Earned Allowance
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Award className={`w-4 h-4 ${earnedAllowance > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
                  <span
                    className={`font-mono text-base sm:text-lg font-extrabold ${
                      earnedAllowance > 0 ? 'text-amber-900' : 'text-slate-600'
                    }`}
                  >
                    {formatCurrency(earnedAllowance)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Smooth Progress Bar */}
          <div className="space-y-1">
            <div className="h-2.5 bg-slate-200/80 rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  achievementPercentage >= 100
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    : achievementPercentage >= 80
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-500'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${achievementProgressClamped}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
              <span>
                {achievementPercentage >= 100 ? (
                  <strong className="text-emerald-700 font-semibold">🎉 100% Monthly Target Achieved!</strong>
                ) : nextTier ? (
                  <span>
                    Need <strong className="font-mono text-slate-800">{formatCurrency(nextTierDeficit)}</strong> more for {nextTier.minPercentage}% ({formatCurrency(nextTier.allowanceAmount)} allowance)
                  </span>
                ) : (
                  <span>Delivered orders count toward allowance</span>
                )}
              </span>
              <span className="font-mono font-semibold text-slate-600">{achievementProgressClamped.toFixed(0)}%</span>
            </div>
          </div>

          {/* Clean, Highlighted Achievement Tiers Strip */}
          <div className="pt-2.5 border-t border-slate-200/70">
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Achievement Tiers:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {ascendingTiers.map((tier, idx) => {
                const isReached = achievementPercentage >= tier.minPercentage;
                const isNextTarget = !isReached && (!ascendingTiers[idx - 1] || achievementPercentage >= ascendingTiers[idx - 1].minPercentage);

                return (
                  <div
                    key={idx}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between transition-all ${
                      isReached
                        ? 'bg-emerald-600 text-white font-bold shadow-xs'
                        : isNextTarget
                        ? 'bg-blue-50 text-blue-900 border-2 border-blue-400 font-bold'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-1 font-bold">
                      {isReached && <CheckCircle2 className="w-3 h-3 text-white" />}
                      {isNextTarget && <Target className="w-3 h-3 text-blue-600" />}
                      <span>{tier.minPercentage}%</span>
                    </span>

                    <span className="font-extrabold">
                      {formatCurrency(tier.allowanceAmount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Priority Follow-ups & Leaderboard Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Follow-Up List Card */}
        <Card className="lg:col-span-2 border-amber-200/70 shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                <span>Follow-Up List</span>
              </CardTitle>
              <CardDescription>Priority follow-up numbers requiring callback</CardDescription>
            </div>

            <Button
              variant="outline"
              size="sm"
              rightIcon={<ArrowRight className="w-3.5 h-3.5 text-amber-600" />}
              onClick={() => navigate('/member/follow-ups?tab=FOLLOW_UP')}
              className="border-amber-200 text-amber-800 hover:bg-amber-50"
            >
              View List
            </Button>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-slate-100">
            {followUpContacts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No priority follow-ups required right now. All caught up!
              </div>
            ) : (
              followUpContacts.map((contact) => (
                <div key={contact.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-amber-50/40 transition-colors">
                  <div>
                    <div className="font-semibold text-sm text-slate-900 font-mono flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      <span>{contact.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge type="contact" status={contact.status} />
                      <span className="text-[11px] text-slate-400">
                        {contact.attemptCount} {contact.attemptCount === 1 ? 'attempt' : 'attempts'}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Phone className="w-3.5 h-3.5" />}
                    onClick={() => setSelectedContact(contact)}
                  >
                    Call Now
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Dashboard Leaderboard Card (Ranked by Delivered Orders) */}
        <Leaderboard
          items={leaderboard.map((m) => ({
            id: m.user.id,
            rank: m.rank,
            name: m.user.fullName,
            avatarUrl: m.user.avatarUrl,
            isCurrentUser: m.user.id === user?.id,
            primaryValue: m.deliveredCount,
            secondaryValue: m.totalOrders,
            primaryLabel: 'Delivered',
            secondaryLabel: 'Total Orders',
            unitLabel: 'orders',
          }))}
          compact={true}
          onViewFullLeaderboard={() => navigate('/member/leaderboard')}
        />
      </div>

      {/* Post Call Modal */}
      {selectedContact && (
        <PostCallModal
          isOpen={!!selectedContact}
          onClose={() => setSelectedContact(null)}
          contact={selectedContact}
          onSuccess={loadData}
        />
      )}
    </div>
  );
};
