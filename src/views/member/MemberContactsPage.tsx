import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Contact, ContactStatus } from '../../models/domain';
import { contactRepository } from '../../repositories';
import { PageHeader } from '../../components/shared/PageHeader';
import { SearchInput } from '../../components/shared/SearchInput';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { LoadingState } from '../../components/shared/LoadingState';
import { PostCallModal } from '../../components/calling/PostCallModal';
import { AddPersonalNumberModal } from '../../components/calling/AddPersonalNumberModal';
import { InboundCallbackDialog } from '../../components/calling/InboundCallbackDialog';
import { Clock, PhoneCall, RotateCcw, Star, MapPin, UserCheck, PlusCircle, Hash, PhoneIncoming } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

type TabCategory =
  | 'ALL'
  | 'NEW'
  | 'FOLLOW_UP'
  | 'ANSWERED'
  | 'NOT_ANSWERED'
  | 'PHONE_OFF'
  | 'INTERESTED'
  | 'NOT_INTERESTED'
  | 'DISPATCHED'
  | 'REJECTED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'SAVED_CONTACTS';

interface TabConfig {
  key: TabCategory;
  label: string;
}

// Strictly ordered filter tabs with All first, New as default selected
const TABS: TabConfig[] = [
  { key: 'ALL', label: 'All' },
  { key: 'NEW', label: 'New' },
  { key: 'FOLLOW_UP', label: 'Follow Up' },
  { key: 'ANSWERED', label: 'Answered' },
  { key: 'NOT_ANSWERED', label: 'Not Answered' },
  { key: 'PHONE_OFF', label: 'Phone Off' },
  { key: 'INTERESTED', label: 'Interested' },
  { key: 'NOT_INTERESTED', label: 'Not Interested' },
  { key: 'DISPATCHED', label: 'Dispatch' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: 'SAVED_CONTACTS', label: 'Saved Contacts' },
];

export const MemberContactsPage: React.FC = () => {
  const { user } = useAuth();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabCategory>('NEW'); // Default is New
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<'OUTBOUND' | 'INBOUND'>('OUTBOUND');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isInboundModalOpen, setIsInboundModalOpen] = useState(false);

  const loadContacts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await contactRepository.getByMemberId(user.id);
      setContacts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();

    const handleExternalUpdate = () => {
      loadContacts();
    };
    window.addEventListener('crm:contact-updated', handleExternalUpdate);
    return () => window.removeEventListener('crm:contact-updated', handleExternalUpdate);
  }, [user]);

  const handleToggleFollowUp = async (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    if (contact.status === 'NEW') return;

    const nextState = !contact.isFollowUp;
    try {
      await contactRepository.update(contact.id, { isFollowUp: nextState });
      toast.success(nextState ? 'Added to Follow-Up List' : 'Removed from Follow-Up List');
      await loadContacts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update follow-up state');
    }
  };

  // Compute counts per category accurately reflecting team member's contacts
  const countMap: Record<TabCategory, number> = {
    ALL: contacts.length,
    NEW: contacts.filter((c) => c.status === 'NEW').length,
    FOLLOW_UP: contacts.filter((c) => c.status !== 'NEW' && c.isFollowUp).length,
    ANSWERED: contacts.filter((c) => c.status === 'ANSWERED').length,
    NOT_ANSWERED: contacts.filter((c) => c.status === 'NOT_ANSWERED').length,
    PHONE_OFF: contacts.filter((c) => c.status === 'PHONE_OFF').length,
    INTERESTED: contacts.filter((c) => c.status === 'INTERESTED').length,
    NOT_INTERESTED: contacts.filter((c) => c.status === 'NOT_INTERESTED').length,
    DISPATCHED: contacts.filter((c) => c.status === 'DISPATCHED').length,
    REJECTED: contacts.filter((c) => c.status === 'REJECTED').length,
    DELIVERED: contacts.filter((c) => c.status === 'DELIVERED').length,
    CANCELLED: contacts.filter((c) => c.status === 'CANCELLED').length,
    SAVED_CONTACTS: contacts.filter((c) => c.isSelfAdded || Boolean(c.addedBy)).length || contacts.length,
  };

  // Filter contacts by active tab & search (Search matches across ALL stages)
  const filteredContacts = contacts.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.phone.toLowerCase().includes(q) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.city && c.city.toLowerCase().includes(q)) ||
      (c.secondaryMobile && c.secondaryMobile.toLowerCase().includes(q)) ||
      (c.importBatchId && c.importBatchId.toLowerCase().includes(q)) ||
      (c.allocationSource && c.allocationSource.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    // When a search term is entered, search across all stages
    if (q) {
      return true;
    }

    if (activeTab === 'ALL') {
      return true;
    }
    if (activeTab === 'FOLLOW_UP') {
      return c.status !== 'NEW' && Boolean(c.isFollowUp);
    }
    if (activeTab === 'SAVED_CONTACTS') {
      const hasSelfAdded = contacts.some((x) => x.isSelfAdded || Boolean(x.addedBy));
      return hasSelfAdded ? Boolean(c.isSelfAdded || c.addedBy) : true;
    }
    return c.status === activeTab;
  });

  if (loading) return <LoadingState rows={8} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contacts & Leads"
        description="Browse assigned leads by status category, filter follow-ups, and launch calling queue"
        actions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<PhoneIncoming className="w-4 h-4 text-emerald-600" />}
            onClick={() => setIsInboundModalOpen(true)}
            className="border-emerald-200 hover:bg-emerald-50 text-emerald-800 font-semibold"
          >
            Inbound Callback
          </Button>
        }
      />

      {/* Filter Tabs Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const count = countMap[tab.key];
            const isActive = activeTab === tab.key;
            const isFollowUpTab = tab.key === 'FOLLOW_UP';
            const isDelivered = tab.key === 'DELIVERED';
            const isRejected = tab.key === 'REJECTED';
            const isNew = tab.key === 'NEW';

            let activeBadgeStyle = 'bg-blue-600 text-white';
            let activeContainerStyle = 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-2xs';

            if (isFollowUpTab) {
              activeBadgeStyle = 'bg-amber-500 text-white font-bold';
              activeContainerStyle = 'bg-amber-100/90 text-amber-900 font-bold border border-amber-300 shadow-2xs';
            } else if (isDelivered) {
              activeBadgeStyle = 'bg-emerald-600 text-white font-bold';
              activeContainerStyle = 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-300 shadow-2xs';
            } else if (isRejected) {
              activeBadgeStyle = 'bg-rose-600 text-white font-bold';
              activeContainerStyle = 'bg-rose-50 text-rose-800 font-bold border border-rose-300 shadow-2xs';
            } else if (isNew) {
              activeBadgeStyle = 'bg-blue-600 text-white font-bold';
              activeContainerStyle = 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-2xs';
            }

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex-1 sm:flex-initial min-w-[115px] sm:min-w-0 ${
                  isActive
                    ? activeContainerStyle
                    : isFollowUpTab
                    ? 'bg-amber-50/70 hover:bg-amber-100/80 text-amber-800 border border-amber-200/80 font-medium'
                    : isRejected
                    ? 'bg-rose-50/50 hover:bg-rose-100/70 text-rose-700 border border-rose-200/60 font-medium'
                    : isDelivered
                    ? 'bg-emerald-50/50 hover:bg-emerald-100/70 text-emerald-700 border border-emerald-200/60 font-medium'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/60'
                }`}
              >
                <span className="whitespace-nowrap flex items-center gap-1.5">
                  {isFollowUpTab && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />}
                  <span>{tab.label}</span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
                    isActive ? activeBadgeStyle : isFollowUpTab ? 'bg-amber-200 text-amber-900' : isRejected ? 'bg-rose-100 text-rose-800' : isDelivered ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={`Search ${
              activeTab === 'SAVED_CONTACTS'
                ? 'saved contacts'
                : activeTab.toLowerCase().replace('_', ' ')
            } by phone, contact code, or city...`}
          />
        </div>
        {search && (
          <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
            Clear
          </Button>
        )}
      </div>

      {/* Contact Cards List */}
      {filteredContacts.length === 0 ? (
        <EmptyState
          title={`No ${
            activeTab === 'SAVED_CONTACTS'
              ? 'Saved'
              : activeTab.toLowerCase().replace('_', ' ')
          } contacts found`}
          description={
            search
              ? `No contacts in this category match "${search}".`
              : activeTab === 'FOLLOW_UP'
              ? 'No contacts have been starred for follow-up yet.'
              : `You currently have 0 contacts in the "${TABS.find((t) => t.key === activeTab)?.label}" category.`
          }
          action={
            activeTab !== 'NEW' ? (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => {
                  setActiveTab('NEW');
                  setSearch('');
                }}
              >
                Switch to New Contacts
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2.5">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className={`bg-white border rounded-xl p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-3 ${
                contact.isFollowUp ? 'border-amber-200/90 bg-amber-50/20' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Left Info Column */}
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Star Icon for Non-NEW contacts */}
                  {contact.status !== 'NEW' && (
                    <button
                      type="button"
                      onClick={(e) => handleToggleFollowUp(contact, e)}
                      className="p-1 rounded-md hover:bg-amber-50 text-slate-400 transition-colors cursor-pointer shrink-0"
                      title={contact.isFollowUp ? 'Remove from Follow-Up List' : 'Add to Follow-Up List'}
                    >
                      <Star
                        className={`w-4 h-4 ${
                          contact.isFollowUp ? 'fill-amber-400 text-amber-500' : 'text-slate-300 hover:text-amber-400'
                        }`}
                      />
                    </button>
                  )}

                  <span className="font-bold text-sm sm:text-base text-slate-900 font-mono tracking-tight">
                    {contact.phone}
                  </span>
                  
                  {contact.code && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/90 rounded-md">
                      <Hash className="w-3 h-3 text-blue-500" />
                      <span>{contact.code}</span>
                    </span>
                  )}

                  <StatusBadge type="contact" status={contact.status} />
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                  {contact.city && (
                    <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{contact.city}</span>
                    </span>
                  )}
                  {contact.secondaryMobile && (
                    <span>
                      <span className="text-slate-400">Alt:</span> <span className="font-mono text-slate-700">{contact.secondaryMobile}</span>
                    </span>
                  )}
                  <span>
                    <span className="text-slate-400 font-normal">Attempts:</span>{' '}
                    <span className="font-semibold text-slate-700">{contact.attemptCount}</span>
                  </span>
                  <span>
                    {contact.lastCalledAt ? (
                      <span className="inline-flex items-center gap-1 font-normal text-slate-600">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{format(new Date(contact.lastCalledAt), 'MMM dd • hh:mm a')}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Not called yet</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Right Action: Single-row Call Button */}
              <Button
                variant="primary"
                size="sm"
                leftIcon={<PhoneCall className="w-3.5 h-3.5" />}
                onClick={() => {
                  setSelectedDirection('OUTBOUND');
                  setSelectedContact(contact);
                }}
                className="shrink-0"
              >
                Call
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Post Call Dialog */}
      {selectedContact && (
        <PostCallModal
          isOpen={!!selectedContact}
          onClose={() => setSelectedContact(null)}
          contact={selectedContact}
          onSuccess={loadContacts}
          initialDirection={selectedDirection}
        />
      )}

      {/* Inbound Callback Dialog */}
      <InboundCallbackDialog
        isOpen={isInboundModalOpen}
        onClose={() => setIsInboundModalOpen(false)}
        onSelectContactForCallback={(contact) => {
          setSelectedDirection('INBOUND');
          setSelectedContact(contact);
        }}
      />

      {/* Add Personal Number Modal */}
      <AddPersonalNumberModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={loadContacts}
        onOpenExistingCallback={(contact) => {
          setSelectedDirection('INBOUND');
          setSelectedContact(contact);
        }}
      />
    </div>
  );
};
