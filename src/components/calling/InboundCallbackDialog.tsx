import React, { useState, useEffect, useMemo } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { StatusBadge } from '../shared/StatusBadge';
import { Contact, DuplicatePhoneCheckResult } from '../../models/domain';
import { contactRepository } from '../../repositories';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';
import {
  PhoneIncoming,
  Search,
  UserCheck,
  History,
  AlertTriangle,
  PlusCircle,
  MapPin,
  Sparkles,
  PhoneCall,
  Clock,
  ChevronRight,
  Hash,
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface InboundCallbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContactForCallback: (contact: Contact) => void;
}

export const InboundCallbackDialog: React.FC<InboundCallbackDialogProps> = ({
  isOpen,
  onClose,
  onSelectContactForCallback,
}) => {
  const { user } = useAuth();

  const [phone, setPhone] = useState('');
  const [allMemberContacts, setAllMemberContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const [isSearching, setIsSearching] = useState(false);
  const [matchedContact, setMatchedContact] = useState<Contact | null>(null);
  const [duplicateResult, setDuplicateResult] = useState<DuplicatePhoneCheckResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Load all accessible contacts for the member when dialog opens
  useEffect(() => {
    if (isOpen && user) {
      setLoadingContacts(true);
      const fetchPromise =
        user.role === 'TEAM_MEMBER'
          ? contactRepository.getByMemberId(user.id)
          : user.teamId
          ? contactRepository.getByTeamId(user.teamId)
          : contactRepository.getAll();

      fetchPromise
        .then((data) => {
          setAllMemberContacts(data);
        })
        .catch((err) => console.error('Failed to load contacts for suggestions:', err))
        .finally(() => setLoadingContacts(false));
    }
  }, [isOpen, user]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setPhone('');
      setMatchedContact(null);
      setDuplicateResult(null);
      setHasSearched(false);
      setIsSearching(false);
    }
  }, [isOpen]);

  const cleanQuery = useMemo(() => {
    return phone.replace(/[^0-9+]/g, '').toLowerCase();
  }, [phone]);

  // Real-time suggestions after typing 4+ digits (EXCLUDING 'NEW' and 'INTERESTED')
  const suggestions = useMemo(() => {
    if (cleanQuery.length < 4) return [];

    return allMemberContacts
      .filter((c) => {
        // Exclude 'NEW' and 'INTERESTED'
        if (c.status === 'NEW' || c.status === 'INTERESTED') {
          return false;
        }

        const cPhone = (c.phone || '').replace(/[^0-9+]/g, '').toLowerCase();
        const secPhone = (c.secondaryMobile || '').replace(/[^0-9+]/g, '').toLowerCase();
        const code = (c.code || '').toLowerCase();

        return cPhone.includes(cleanQuery) || secPhone.includes(cleanQuery) || code.includes(cleanQuery);
      })
      .slice(0, 10); // Show up to top 10 relevant matches
  }, [cleanQuery, allMemberContacts]);

  const handleSearch = async (queryPhone?: string) => {
    const rawPhone = (queryPhone !== undefined ? queryPhone : phone).trim();
    if (!rawPhone || rawPhone.length < 4 || !user) return;

    setIsSearching(true);
    setHasSearched(true);
    try {
      // 1. Direct contact lookup
      const contact = await contactRepository.getByPhone(rawPhone);
      setMatchedContact(contact);

      // 2. Intelligence check
      const dup = await contactRepository.checkDuplicate({
        phone: rawPhone,
        memberId: user.id,
        teamId: user.teamId || undefined,
      });
      setDuplicateResult(dup);

      // If contact was not found via getByPhone but returned by checkDuplicate:
      if (!contact && dup.contact) {
        setMatchedContact(dup.contact);
      }
    } catch (err) {
      console.error('Error looking up caller:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleQuickCreateAndLog = async () => {
    if (!user || !user.teamId) {
      toast.error('You must belong to a team to create contacts.');
      return;
    }
    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.length < 7) {
      toast.error('Please enter a valid phone number with at least 7 digits.');
      return;
    }

    setIsCreatingNew(true);
    try {
      const newContact = await contactRepository.addPersonalNumber({
        phone: cleanPhone,
        memberId: user.id,
        teamId: user.teamId,
        code: `INB-${Math.floor(100 + Math.random() * 900)}`,
      });

      toast.success(`Registered incoming caller ${cleanPhone}!`);
      onClose();
      onSelectContactForCallback(newContact);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create contact for callback.');
    } finally {
      setIsCreatingNew(false);
    }
  };

  const handleProceedWithExisting = (targetContact: Contact) => {
    onClose();
    onSelectContactForCallback(targetContact);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Inbound Callback & Caller Lookup"
      description="Identify incoming callers with previous call history, review previous notes, and update status seamlessly without duplicate leads."
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Search Header */}
        <div className="relative">
          <label className="text-xs font-bold text-slate-700 block mb-1">Incoming Caller Phone Number *</label>
          <div className="relative">
            <input
              type="text"
              autoFocus
              placeholder="Type phone number (e.g. 0771... or +94...)"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setMatchedContact(null);
                setHasSearched(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              className="w-full pl-9 pr-24 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <div className="absolute right-1.5 top-1.5">
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => handleSearch()}
                isLoading={isSearching}
                className="text-xs font-semibold px-3 h-8"
              >
                Lookup
              </Button>
            </div>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            Type at least 4 digits to see suggestions with prior call history (Not Answered, Phone Off, Follow-Up, Not Interested, etc.)
          </span>
        </div>

        {/* 1. AUTOCOMPLETE SUGGESTIONS (TRIGGERS AFTER 4 DIGITS) */}
        {cleanQuery.length >= 4 && !matchedContact && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  Suggested Callbacks ({suggestions.length} Matching{' '}
                  <span className="text-[11px] font-normal text-slate-500">excluding New &amp; Interested</span>)
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Query: &quot;{cleanQuery}&quot;</span>
            </div>

            {suggestions.length > 0 ? (
              <div className="max-h-64 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-1.5 bg-slate-50/70">
                {suggestions.map((contact) => (
                  <div
                    key={contact.id}
                    onClick={() => handleProceedWithExisting(contact)}
                    className="p-2.5 bg-white hover:bg-blue-50/70 border border-slate-200/90 hover:border-blue-300 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 shadow-2xs group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-slate-900 group-hover:text-blue-700 transition-colors">
                          {contact.phone}
                        </span>
                        {contact.code && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-100 text-slate-700 border border-slate-200 rounded">
                            <Hash className="w-2.5 h-2.5 text-slate-400" />
                            {contact.code}
                          </span>
                        )}
                        <StatusBadge type="contact" status={contact.status} />
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span>Attempts: <strong className="text-slate-700 font-mono">{contact.attemptCount || 0}</strong></span>
                        {contact.city && (
                          <span>&bull; <MapPin className="w-3 h-3 inline text-slate-400" /> {contact.city}</span>
                        )}
                        {contact.lastCalledAt && (
                          <span>
                            &bull; <Clock className="w-3 h-3 inline text-slate-400" /> Last Called:{' '}
                            <strong className="text-slate-700">{format(new Date(contact.lastCalledAt), 'MMM dd • hh:mm a')}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      leftIcon={<PhoneCall className="w-3.5 h-3.5" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProceedWithExisting(contact);
                      }}
                      className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-2xs"
                    >
                      Log Callback
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                No contacts with prior call history (Not Answered, Phone Off, Follow-Up, Not Interested) match &quot;{cleanQuery}&quot;.
              </div>
            )}
          </div>
        )}

        {/* 2. LOADING STATE */}
        {isSearching && (
          <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent mb-2" />
            <div className="text-xs text-slate-500 font-medium">Searching CRM contact index...</div>
          </div>
        )}

        {/* 3. EXPLICIT LOOKUP RESULTS DISPLAY */}
        {!isSearching && hasSearched && (
          <>
            {/* A. EXACT MATCH FOUND */}
            {matchedContact ? (
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3.5 shadow-xs animate-in fade-in duration-150">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{matchedContact.phone}</span>
                        {matchedContact.code && (
                          <span className="font-mono text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.2 rounded">
                            {matchedContact.code}
                          </span>
                        )}
                        <StatusBadge type="contact" status={matchedContact.status} />
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>Total Attempts: <strong className="text-slate-800 font-mono">{matchedContact.attemptCount || 0}</strong></span>
                        {matchedContact.city && (
                          <span>&bull; <MapPin className="w-3 h-3 inline text-slate-400" /> {matchedContact.city}</span>
                        )}
                        {matchedContact.lastCalledAt && (
                          <span>&bull; Last Called: <strong className="text-slate-700">{format(new Date(matchedContact.lastCalledAt), 'MMM dd, yyyy • hh:mm a')}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Call History Snippet */}
                {matchedContact.callLogs && matchedContact.callLogs.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                      <History className="w-3.5 h-3.5 text-blue-600" />
                      <span>Latest Interaction Note:</span>
                    </div>
                    {matchedContact.callLogs[0]?.remarks ? (
                      <p className="text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                        &quot;{matchedContact.callLogs[0].remarks}&quot;
                      </p>
                    ) : (
                      <p className="text-slate-400 italic">No specific remarks recorded on previous attempt.</p>
                    )}
                  </div>
                )}

                {/* Action Trigger */}
                <div className="pt-1 flex justify-end">
                  <Button
                    type="button"
                    variant="primary"
                    leftIcon={<PhoneIncoming className="w-4 h-4" />}
                    onClick={() => handleProceedWithExisting(matchedContact)}
                    className="w-full sm:w-auto text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  >
                    Log Inbound Callback Outcome &amp; Update Status
                  </Button>
                </div>
              </div>
            ) : duplicateResult && duplicateResult.exists && duplicateResult.intelligence ? (
              /* B. MATCH FOUND IN ANOTHER QUEUE OR CROSS-TEAM */
              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-950">
                      Contact Exists with Another Team Member
                    </h4>
                    <p className="text-xs text-amber-800 mt-0.5">
                      This caller ({duplicateResult.intelligence.phone}) is registered under{' '}
                      <strong>{duplicateResult.intelligence.assignedMemberName}</strong> ({duplicateResult.intelligence.teamName}).
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white border border-amber-100 rounded-xl text-xs space-y-1.5 text-slate-600">
                  <div>
                    <span className="text-slate-400">Current Status:</span>{' '}
                    <strong className="text-slate-800 font-medium">
                      {duplicateResult.intelligence.lastCallStatus || 'NEW'}
                    </strong>
                  </div>
                  {duplicateResult.intelligence.lastCalledAt && (
                    <div>
                      <span className="text-slate-400">Last Contacted:</span>{' '}
                      <strong className="text-slate-800 font-medium">
                        {format(new Date(duplicateResult.intelligence.lastCalledAt), 'MMM dd, yyyy • hh:mm a')}
                      </strong>
                    </div>
                  )}
                  {duplicateResult.intelligence.lastCallRemarks && (
                    <div className="text-slate-600 italic bg-amber-50/50 p-2 rounded border border-amber-100 mt-1">
                      &quot;{duplicateResult.intelligence.lastCallRemarks}&quot;
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* C. BRAND NEW CALLER (NOT FOUND IN CRM) */
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-center">
                <div className="w-10 h-10 bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center mx-auto">
                  <PhoneIncoming className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Brand New Caller (Not Found in CRM)</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Phone number <strong>{phone}</strong> has not been registered or called previously.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  leftIcon={<PlusCircle className="w-4 h-4" />}
                  onClick={handleQuickCreateAndLog}
                  isLoading={isCreatingNew}
                  className="w-full sm:w-auto text-xs font-bold mx-auto"
                >
                  Create Contact &amp; Log Callback Outcome
                </Button>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
