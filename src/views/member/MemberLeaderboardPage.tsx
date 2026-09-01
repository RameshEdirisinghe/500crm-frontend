import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userRepository, orderRepository } from '../../repositories';
import { PageHeader } from '../../components/shared/PageHeader';
import { Leaderboard, LeaderboardItem } from '../../components/leaderboard';

export const MemberLeaderboardPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLeaderboard = async () => {
      setLoading(true);
      try {
        const currentTeamId = user?.teamId;
        if (!currentTeamId) {
          setItems([]);
          return;
        }
        const [teamUsers, allOrders] = await Promise.all([
          userRepository.getByTeamId(currentTeamId),
          orderRepository.getByTeamId(currentTeamId),
        ]);

        const members = teamUsers.filter((u) => u.role === 'TEAM_MEMBER' && u.isActive);

        const list: LeaderboardItem[] = members.map((m) => {
          const mOrders = allOrders.filter((o) => o.teamMemberId === m.id);
          const deliveredOrdersCount = mOrders.filter((o) => o.status === 'DELIVERED').length;
          const totalOrdersCount = mOrders.length;

          return {
            id: m.id,
            rank: 0,
            name: m.fullName,
            avatarUrl: m.avatarUrl,
            isCurrentUser: m.id === user?.id,
            primaryValue: deliveredOrdersCount,
            secondaryValue: totalOrdersCount,
            primaryLabel: 'Delivered',
            secondaryLabel: 'Total Orders',
            unitLabel: 'orders',
          };
        });

        // 1.2 Rank by Delivered Orders (highest delivered count first)
        list.sort((a, b) => b.primaryValue - a.primaryValue || b.secondaryValue - a.secondaryValue);

        list.forEach((item, idx) => {
          item.rank = idx + 1;
        });

        setItems(list);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [user]);

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <PageHeader
        title="Delivered Orders Leaderboard"
        description="Team member rankings ranked by verified delivered customer orders"
      />

      <Leaderboard
        items={items}
        loading={loading}
        chartTitle="Delivered Orders Ranking"
        tableTitle="Delivered Orders Performance Table"
        primaryLabel="Delivered"
        secondaryLabel="Total Orders"
        unitLabel="orders"
      />
    </div>
  );
};
