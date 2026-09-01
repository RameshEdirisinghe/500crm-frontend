import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Customer, User, ActivityLog, Order } from '../../models/domain';
import { customerRepository, userRepository, activityLogRepository, orderRepository } from '../../repositories';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ActivityTimeline } from '../../components/shared/ActivityTimeline';
import { LoadingState } from '../../components/shared/LoadingState';
import { getTeamBranding } from '../../config/branding';
import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const SupervisorCustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [member, setMember] = useState<User | null>(null);
  const [supervisor, setSupervisor] = useState<User | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCustomer = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const cust = await customerRepository.getById(id);
        if (cust) {
          setCustomer(cust);

          const [mUser, sUser, logs, custOrders] = await Promise.all([
            userRepository.getById(cust.responsibleTeamMemberId),
            userRepository.getById(cust.supervisorId),
            activityLogRepository.getAll(),
            orderRepository.getByCustomerId(cust.id),
          ]);

          setMember(mUser);
          setSupervisor(sUser);
          setOrders(custOrders);

          // Filter logs related to this customer, contact, or orders
          const orderIds = custOrders.map((o) => o.id);
          const relevantLogs = logs.filter(
            (l) =>
              l.entityId === cust.id ||
              l.entityId === cust.contactId ||
              orderIds.includes(l.entityId)
          );

          setActivities(relevantLogs);
        }
      } finally {
        setLoading(false);
      }
    };

    loadCustomer();
  }, [id]);

  if (loading) return <LoadingState rows={8} />;
  if (!customer) return <div className="p-6 text-center text-slate-500">Customer record not found.</div>;

  const teamBrand = getTeamBranding(user?.teamId === customer.teamId ? user.team || customer.team : customer.team);

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<ArrowLeft className="w-4 h-4" />}
        onClick={() => navigate('/supervisor/interested')}
      >
        Back to Interested Leads
      </Button>

      <PageHeader
        title={customer.fullName}
        description={`Customer CRM Profile & Communication Timeline • ${teamBrand.name}`}
      />

      {/* Header Info Banner */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contact Info</div>
              <div className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-600" />
                <span className="font-mono">{customer.phone}</span>
              </div>
              {customer.email && (
                <div className="text-xs text-slate-600 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{customer.email}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Delivery Address</div>
              <div className="text-xs font-medium text-slate-800 flex items-start gap-1.5 leading-snug">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>{customer.address}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Assigned Officers</div>
              <div className="text-xs text-slate-700">
                Member: <span className="font-semibold text-slate-900">{member ? member.fullName : 'N/A'}</span>
              </div>
              <div className="text-xs text-slate-700">
                Supervisor: <span className="font-semibold text-slate-900">{supervisor ? supervisor.fullName : 'N/A'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chronological CRM Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Communication & Activity History</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityTimeline activities={activities} />
        </CardContent>
      </Card>
    </div>
  );
};
