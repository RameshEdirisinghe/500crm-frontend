import React, { useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Contact } from '../../models/domain';
import { useAuth } from '../../hooks/useAuth';
import { contactRepository } from '../../repositories';
import { ActivityLogService } from '../../services/activityLogService';
import toast from 'react-hot-toast';
import { Phone, MapPin, UserCheck, ShieldCheck, ArrowRight, ArrowLeft, Hash, AlertCircle } from 'lucide-react';

export interface AddPersonalNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onOpenExistingCallback?: (contact: Contact) => void;
}

export const AddPersonalNumberModal: React.FC<AddPersonalNumberModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenExistingCallback,
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'DETAILS' | 'CONFIRM_CODE'>('DETAILS');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [secondaryMobile, setSecondaryMobile] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingContact, setExistingContact] = useState<Contact | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  const resetForm = () => {
    setStep('DETAILS');
    setPhone('');
    setCity('');
    setSecondaryMobile('');
    setCode('');
    setCodeError('');
    setIsSubmitting(false);
    setExistingContact(null);
    setIsCheckingDuplicate(false);
  };

  // Debounced duplicate detection
  React.useEffect(() => {
    const clean = phone.replace(/[^0-9+]/g, '');
    if (clean.length >= 7 && user) {
      const timer = setTimeout(async () => {
        setIsCheckingDuplicate(true);
        try {
          const res = await contactRepository.checkDuplicate({
            phone: clean,
            memberId: user.id,
            teamId: user.teamId || undefined,
          });
          if (res.exists && res.isOwnedBySelf && res.contact) {
            setExistingContact(res.contact);
          } else {
            setExistingContact(null);
          }
        } catch {
          setExistingContact(null);
        } finally {
          setIsCheckingDuplicate(false);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setExistingContact(null);
    }
  }, [phone, user]);

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };

  if (!user) return null;

  const handleProceedToCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.trim();

    // Validation: Phone format
    if (!cleanPhone || cleanPhone.length < 7) {
      toast.error('Please enter a valid phone number (at least 7 digits).');
      return;
    }

    if (existingContact) {
      toast.error('This number is already in your contacts list. Click "Open to Log Inbound Callback" to update its status.');
      return;
    }

    if (secondaryMobile.trim() && secondaryMobile.trim().length < 7) {
      toast.error('Secondary mobile number must have at least 7 digits.');
      return;
    }
    if (!user.teamId) {
      toast.error('Your account is not assigned to a team. Please contact an administrator.');
      return;
    }

    setCodeError('');
    setStep('CONFIRM_CODE');
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.trim();
    const cleanCode = code.trim();

    if (!cleanCode) {
      setCodeError('Please enter the unique contact code before continuing.');
      return;
    }

    if (cleanCode.length < 2) {
      setCodeError('Contact code must be at least 2 characters long.');
      return;
    }

    if (!user.teamId) {
      toast.error('Your account is not assigned to a team.');
      return;
    }

    setIsSubmitting(true);
    setCodeError('');
    try {
      // 1. Add and auto-allocate to current team member with entered contact code
      const newContact = await contactRepository.addPersonalNumber({
        phone: cleanPhone,
        memberId: user.id,
        teamId: user.teamId,
        city: city.trim() || undefined,
        secondaryMobile: secondaryMobile.trim() || undefined,
        code: cleanCode,
      });

      // 2. Log activity
      await ActivityLogService.logAction({
        userId: user.id,
        userRole: user.role,
        userName: user.fullName,
        teamId: user.teamId,
        action: 'NUMBER_ADDED',
        entityType: 'Contact',
        entityId: newContact.id,
        description: `Self-added personal contact number ${cleanPhone} [Code: ${cleanCode}] (Auto-allocated to ${user.fullName})`,
      });

      toast.success(`Contact ${cleanPhone} [${cleanCode}] created and added to your list!`);
      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      setCodeError(err.message || 'Failed to add contact number.');
      toast.error(err.message || 'Failed to add contact number.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'DETAILS' ? 'Add Personal Contact Number' : 'Confirm Contact Code'}
      description={
        step === 'DETAILS'
          ? 'Add a new customer lead number directly to your assigned calling queue'
          : 'Enter the unique code associated with this contact to finalize creation'
      }
      maxWidth="md"
    >
      {step === 'DETAILS' ? (
        <form onSubmit={handleProceedToCode} className="space-y-4">
          {/* Auto-allocation info banner */}
          <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="text-xs text-blue-900">
              <span className="font-semibold">Automatic Allocation:</span> This number will be automatically assigned to you (<strong>{user.fullName}</strong>).
            </div>
          </div>

          <Input
            label="Primary Contact Number *"
            placeholder="e.g. +94 77 123 4567 or 0771234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            leftIcon={<Phone className="w-4 h-4 text-slate-400" />}
            required
            autoFocus
          />

          {/* Detected Existing Contact Banner */}
          {existingContact && (
            <div className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-3.5 space-y-2.5 shadow-2xs animate-in fade-in duration-150">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Contact already exists in your queue!</span>
                  </div>
                  <div className="text-[11px] text-emerald-800 mt-1 flex items-center gap-2 flex-wrap">
                    <span>Current Status: <strong className="uppercase">{existingContact.status}</strong></span>
                    <span>&bull; Attempts: <strong>{existingContact.attemptCount || 0}</strong></span>
                    {existingContact.city && <span>&bull; City: <strong>{existingContact.city}</strong></span>}
                  </div>
                </div>
              </div>
              {onOpenExistingCallback && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    handleClose();
                    onOpenExistingCallback(existingContact);
                  }}
                  className="w-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                >
                  Open to Log Inbound Callback &amp; Update Status
                </Button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="City / Location (Optional)"
              placeholder="e.g. Colombo, Kandy"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              leftIcon={<MapPin className="w-4 h-4 text-slate-400" />}
            />

            <Input
              label="Secondary Mobile (Optional)"
              placeholder="e.g. +94 71 987 6543"
              value={secondaryMobile}
              onChange={(e) => setSecondaryMobile(e.target.value)}
              leftIcon={<Phone className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <div className="pt-2 text-xs text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Next step will ask for the unique contact code before creation.</span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Continue to Code Confirmation
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleFinalSubmit} className="space-y-4">
          {/* Target Contact Summary */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 space-y-2">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Target Contact Summary
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-800">
                <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="font-mono font-bold text-sm">{phone}</span>
              </div>

              {city && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{city}</span>
                </div>
              )}

              {secondaryMobile && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono">{secondaryMobile}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-slate-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>Assigned to: <strong className="text-slate-800">{user.fullName}</strong></span>
              </div>
            </div>
          </div>

          {/* Unique Contact Code Input */}
          <div>
            <Input
              label="Unique Contact Code *"
              placeholder="e.g. CTC-0091, LEAD-7812, PR-450"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (codeError) setCodeError('');
              }}
              leftIcon={<Hash className="w-4 h-4 text-blue-600" />}
              autoFocus
              disabled={isSubmitting}
              required
            />
            <p className="text-[11px] text-slate-500 mt-1 font-sans">
              Enter the unique code associated with this contact. It will be permanently stored and linked with this contact record.
            </p>
          </div>

          {/* Error display */}
          {codeError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{codeError}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Contact will not be created until code is entered and confirmed.</span>
          </div>

          <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep('DETAILS')}
              disabled={isSubmitting}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to Details
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                leftIcon={<Hash className="w-4 h-4" />}
              >
                Confirm &amp; Create Contact
              </Button>
            </div>
          </div>
        </form>
      )}
    </Dialog>
  );
};
