import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ContactService, ImportSummary } from '../../services/contactService';
import { parseExcelContactSheet, extractPhonesFromBulkText, ExcelContactParseResult, normalizeSriLankanPhone } from '../../utils/phoneUtils';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatCurrency } from '../../utils/currency';
import type { DuplicatePhoneIntelligence } from '../../models/domain';
import toast from 'react-hot-toast';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Phone, 
  ArrowRight, 
  MessageSquareCode, 
  Filter, 
  X,
  UserCheck,
  Sparkles,
  User,
  Clock,
  MapPin,
  ShoppingBag,
  MessageSquare,
  Eye,
  PlusCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { ContactCodeConfirmationModal, ContactPreviewInfo } from '../../components/contacts/ContactCodeConfirmationModal';

export const MemberImportPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Single manual contact state
  const [manualPhone, setManualPhone] = useState('');
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);

  // Duplicate Number Claim Modal State
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimIntelligence, setClaimIntelligence] = useState<DuplicatePhoneIntelligence | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  // Contact Code Confirmation Modal State
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [pendingContactInfo, setPendingContactInfo] = useState<ContactPreviewInfo | null>(null);
  const [pendingActionType, setPendingActionType] = useState<'MANUAL_ADD' | 'CLAIM'>('MANUAL_ADD');

  // Bulk text area numbers state
  const [bulkText, setBulkText] = useState('');
  const [isBulkTextProcessing, setIsBulkTextProcessing] = useState(false);

  // Bulk import file state
  const [file, setFile] = useState<File | null>(null);
  const [parsedFileInfo, setParsedFileInfo] = useState<ExcelContactParseResult | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [executeFn, setExecuteFn] = useState<((code?: string) => Promise<any>) | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedClaimablePhones, setSelectedClaimablePhones] = useState<string[]>([]);

  // Tab filter for bottom numbers preview
  const [previewTab, setPreviewTab] = useState<'ALL' | 'VALID' | 'CLAIMABLE' | 'DUPLICATES' | 'INVALID'>('ALL');

  // Single Contact Submit & Intelligent Duplicate Check
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhone.trim() || !user) return;

    const norm = normalizeSriLankanPhone(manualPhone);
    if (!norm) {
      toast.error('Invalid Sri Lankan mobile format. Must be 10 digits starting with 07.');
      return;
    }

    setIsManualSubmitting(true);
    try {
      const dupCheck = await ContactService.checkPhoneDuplicate(norm, user);

      if (dupCheck.exists) {
        if (dupCheck.isOwnedBySelf) {
          toast.error(`Duplicate rejected: Phone number ${norm} is already in your personal queue.`);
          setIsManualSubmitting(false);
          return;
        }

        // Duplicate exists under another member / general CRM -> Open Claim Dialog
        if (dupCheck.intelligence) {
          setClaimIntelligence(dupCheck.intelligence);
          setClaimModalOpen(true);
          setIsManualSubmitting(false);
          return;
        }
      }

      // Brand new contact -> Open Contact Code Confirmation Modal
      setPendingContactInfo({
        phone: norm,
        assigneeName: user.fullName,
      });
      setPendingActionType('MANUAL_ADD');
      setCodeModalOpen(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to process contact.');
    } finally {
      setIsManualSubmitting(false);
    }
  };

  // Open Code Confirmation for Claiming Duplicate Contact
  const handleInitiateClaim = () => {
    if (!claimIntelligence || !user) return;
    setPendingContactInfo({
      phone: claimIntelligence.phone,
      city: claimIntelligence.city || undefined,
      assigneeName: user.fullName,
    });
    setPendingActionType('CLAIM');
    setClaimModalOpen(false);
    setCodeModalOpen(true);
  };

  // Open Bulk Confirmation Modal
  const handleOpenBulkConfirmModal = () => {
    if (!importSummary || !executeFn) return;
    const totalToImport = importSummary.validCount + selectedClaimablePhones.length;
    if (totalToImport === 0) return;

    setPendingContactInfo({
      batchCount: totalToImport,
      assigneeName: user?.fullName,
      customTitle: `Confirm Code for ${totalToImport} Contacts`,
      customDescription: `Please enter the unique batch/contact code before importing these ${totalToImport} contacts into your personal calling queue.`,
    });
    setCodeModalOpen(true);
  };

  // Confirm Contact Creation / Bulk Import with Entered Code
  const handleConfirmWithCode = async (enteredCode: string) => {
    if (!pendingContactInfo || !user) return;

    // 1. Bulk Import Mode
    if (pendingContactInfo.batchCount && executeFn) {
      setIsImporting(true);
      try {
        const imported = await executeFn(enteredCode.trim());
        toast.success(`Successfully imported ${imported.length} contacts [Code: ${enteredCode.trim()}] into your calling queue!`);
        setCodeModalOpen(false);
        setPendingContactInfo(null);
        setImportSummary(null);
        setFile(null);
        setBulkText('');
        setExecuteFn(null);
        setSelectedClaimablePhones([]);
        navigate('/member/contacts');
      } catch (err: any) {
        toast.error(err.message || 'Import failed.');
        throw err;
      } finally {
        setIsImporting(false);
      }
      return;
    }

    // 2. Single Contact Add / Claim Mode
    setIsClaiming(true);
    try {
      await ContactService.addPersonalContact(
        pendingContactInfo.phone!,
        user,
        pendingContactInfo.city,
        pendingContactInfo.secondaryMobile,
        enteredCode
      );

      toast.success(`Successfully added contact ${pendingContactInfo.phone} [${enteredCode}] to your queue!`);
      setCodeModalOpen(false);
      setPendingContactInfo(null);
      setClaimIntelligence(null);
      setManualPhone('');
      navigate('/member/contacts');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save contact with code.');
      throw err;
    } finally {
      setIsClaiming(false);
    }
  };

  // Bulk Text / Message Numbers Extraction & Parse
  const handleProcessBulkText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim() || !user) {
      toast.error('Please paste or enter phone numbers first.');
      return;
    }

    setIsBulkTextProcessing(true);
    try {
      const extractedNumbers = extractPhonesFromBulkText(bulkText);

      if (extractedNumbers.length === 0) {
        toast.error('No valid Sri Lankan mobile numbers found in input text.');
        setIsBulkTextProcessing(false);
        return;
      }

      setSelectedClaimablePhones([]);
      const { summary, executeImport } = await ContactService.processBulkImport(extractedNumbers, user);
      setImportSummary(summary);
      setExecuteFn(() => executeImport);
      toast.success(`Extracted & normalized ${extractedNumbers.length} Sri Lankan mobile numbers!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to process bulk numbers.');
    } finally {
      setIsBulkTextProcessing(false);
    }
  };

  // Excel / CSV File Change & Parse
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected || !user) return;
    setFile(selected);

    try {
      const parseResult = await parseExcelContactSheet(selected);
      setParsedFileInfo(parseResult);

      if (parseResult.contactNumbers.length === 0) {
        toast.error(`No valid contact numbers found in column "${parseResult.contactColumnName}".`);
        return;
      }

      setSelectedClaimablePhones([]);
      const { summary, executeImport } = await ContactService.processBulkImport(
        parseResult.contactNumbers,
        user
      );
      setImportSummary(summary);
      setExecuteFn(() => executeImport);
      toast.success(
        `Extracted ${parseResult.contactNumbers.length} contacts from "${parseResult.contactColumnName}" column.`
      );
    } catch (err: any) {
      toast.error('Error parsing spreadsheet: ' + err.message);
    }
  };

  // Toggle Claimable Phone in Bulk Import
  const handleToggleClaimPhone = (phone: string) => {
    if (!user || !importSummary) return;
    const isSelected = selectedClaimablePhones.includes(phone);
    const updated = isSelected
      ? selectedClaimablePhones.filter((p) => p !== phone)
      : [...selectedClaimablePhones, phone];
    setSelectedClaimablePhones(updated);

    // Re-create executeImport with updated claimable phones
    const allExtracted = importSummary.rows.map((r) => r.phone);
    ContactService.processBulkImport(allExtracted, user, updated).then(({ executeImport }) => {
      setExecuteFn(() => executeImport);
    });
  };

  // Confirm Import & Directly Allocate to Current Member
  const handleConfirmImport = async () => {
    if (!executeFn) return;
    setIsImporting(true);
    try {
      const imported = await executeFn();
      toast.success(`Successfully imported ${imported.length} contacts directly into your calling list!`);
      setImportSummary(null);
      setFile(null);
      setBulkText('');
      setExecuteFn(null);
      navigate('/member/contacts');
    } catch (err: any) {
      toast.error(err.message || 'Import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  // Filtered rows for audit preview
  const displayedRows = importSummary
    ? importSummary.rows.filter((r) => {
        if (previewTab === 'VALID') return r.isValid && !r.isDuplicate;
        if (previewTab === 'CLAIMABLE') return r.isClaimableDuplicate;
        if (previewTab === 'DUPLICATES') return r.isOwnDuplicate;
        if (previewTab === 'INVALID') return !r.isValid;
        return true;
      })
    : [];

  const totalSelectedToImport = (importSummary?.validCount || 0) + selectedClaimablePhones.length;

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full overflow-hidden pb-24">
      <PageHeader
        title="Import Numbers Myself"
        description="Add calling contacts directly to your personal queue using bulk text, manual entry, or CSV"
      />

      {/* Auto-Allocation Notice Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-blue-900 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold">Personal Number Claim &amp; Allocation:</span> Numbers added or claimed will be immediately assigned to you (<span className="font-semibold">{user?.fullName}</span>) and visible in your personal calling queue.
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-white/80 px-2 py-0.5 rounded-full border border-blue-200">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Intelligent Duplicate Detection</span>
        </div>
      </div>

      {/* Top 3 Cards Grid (Accessible to Team Members) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Bulk Text Msg / Numbers Input */}
        <Card className="flex flex-col justify-between md:col-span-1 border-blue-200/80 shadow-2xs hover:shadow-xs transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <MessageSquareCode className="w-4 h-4 text-blue-600" />
                <span>Bulk Text / Numbers Entry</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                No Excel Needed
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col justify-between">
            <form onSubmit={handleProcessBulkText} className="space-y-3 flex-1 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-700">Paste Numbers *</label>
                  {bulkText && (
                    <button
                      type="button"
                      onClick={() => setBulkText('')}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition-colors"
                    >
                      <X className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
                <div className="relative">
                  <textarea
                    className="w-full h-24 p-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors resize-none pr-8"
                    placeholder="e.g. 0750787818  0705787818  0713044381 (Space, comma or line separated)"
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    required
                  />
                  {bulkText && (
                    <button
                      type="button"
                      onClick={() => setBulkText('')}
                      className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                      title="Clear text area"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="w-full"
                isLoading={isBulkTextProcessing}
                leftIcon={<Filter className="w-3.5 h-3.5" />}
              >
                Extract &amp; Process Numbers
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Card 2: Single Contact Entry */}
        <Card className="flex flex-col justify-between border-purple-200/80 shadow-2xs hover:shadow-xs transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-purple-600" />
              <span>Single Number Entry</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col justify-between">
            <form onSubmit={handleManualSubmit} className="space-y-3 flex-1 flex flex-col justify-between">
              <Input
                label="Phone Number *"
                placeholder="e.g. 0750787818"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                onClear={() => setManualPhone('')}
                required
                helperText="Detects duplicates & allows claiming numbers from other reps"
              />

              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="w-full"
                isLoading={isManualSubmitting}
                leftIcon={<Phone className="w-3.5 h-3.5" />}
              >
                Check &amp; Add Number
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Card 3: Excel / CSV File Upload */}
        <Card className="flex flex-col justify-between border-emerald-200/80 shadow-2xs hover:shadow-xs transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Excel / CSV Spreadsheet Upload</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col justify-between">
            <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center bg-slate-50/60 hover:bg-emerald-50/30 hover:border-emerald-400 transition-colors relative">
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-600 font-medium mb-1">
                Upload Excel or CSV contact spreadsheet
              </p>
              <p className="text-[11px] text-slate-400 mb-3">
                Reads <strong>only</strong> the <code className="text-emerald-700 font-semibold">Contact</code> column.
              </p>
              <div className="flex items-center justify-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 shadow-xs cursor-pointer transition-colors">
                  <span>Select Excel / CSV File</span>
                  <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileChange} className="hidden" />
                </label>
                {file && (
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setParsedFileInfo(null);
                      setImportSummary(null);
                      setExecuteFn(null);
                      setSelectedClaimablePhones([]);
                    }}
                    className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    title="Remove selected file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {file && (
                <div className="text-[11px] font-semibold text-emerald-700 mt-2 truncate">
                  Loaded: {file.name}
                </div>
              )}
            </div>

            {parsedFileInfo && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5 text-[11px] space-y-1 text-slate-700">
                <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Column Identified: "{parsedFileInfo.contactColumnName}"</span>
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-400 text-center">Supports .xlsx, .xls, and .csv formats</p>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Listing & Duplicate Audit Section */}
      {importSummary && (
        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-200 border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 p-3.5 sm:p-5 space-y-3 sm:space-y-4">
            {/* Title Header */}
            <div>
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Parsed Numbers Audit ({importSummary.totalParsed} total)</span>
              </CardTitle>
            </div>

            {/* Metric counters grid - Clean Full Width */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <div className="text-[10px] sm:text-[11px] font-bold text-emerald-800 uppercase tracking-tight">Valid Brand New</div>
                <div className="text-base sm:text-xl font-extrabold text-emerald-900 mt-0.5">{importSummary.validCount}</div>
              </div>
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-center">
                <div className="text-[10px] sm:text-[11px] font-bold text-amber-800 uppercase tracking-tight">Claimable Existing</div>
                <div className="text-base sm:text-xl font-extrabold text-amber-900 mt-0.5">{importSummary.claimableDuplicateCount}</div>
              </div>
              <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-center">
                <div className="text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-tight">Own Duplicates</div>
                <div className="text-base sm:text-xl font-extrabold text-slate-800 mt-0.5">{importSummary.ownDuplicateCount}</div>
              </div>
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-center">
                <div className="text-[10px] sm:text-[11px] font-bold text-rose-800 uppercase tracking-tight">Invalid Formats</div>
                <div className="text-base sm:text-xl font-extrabold text-rose-900 mt-0.5">{importSummary.invalidCount}</div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Wrapping Filter Tabs (Like Call Logs) */}
            <div className="flex flex-wrap items-center gap-1.5 p-2.5 sm:p-3 border-b border-slate-100 bg-slate-50/70 text-xs">
              <button
                type="button"
                onClick={() => setPreviewTab('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  previewTab === 'ALL'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All ({importSummary.rows.length})
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('VALID')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  previewTab === 'VALID'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                Valid New ({importSummary.validCount})
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('CLAIMABLE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  previewTab === 'CLAIMABLE'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300'
                }`}
              >
                Claimable ({importSummary.claimableDuplicateCount})
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('DUPLICATES')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  previewTab === 'DUPLICATES'
                    ? 'bg-slate-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Own Duplicates ({importSummary.ownDuplicateCount})
              </button>
              {importSummary.invalidCount > 0 && (
                <button
                  type="button"
                  onClick={() => setPreviewTab('INVALID')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    previewTab === 'INVALID'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  Invalid ({importSummary.invalidCount})
                </button>
              )}
            </div>

            {/* Table */}
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5 w-12">#</th>
                    <th className="px-4 py-2.5">Phone Number</th>
                    <th className="px-4 py-2.5">Status &amp; Ownership</th>
                    <th className="px-4 py-2.5">Action / Info</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-400 font-sans">
                        No rows found in this filter tab.
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-2.5 text-slate-400 font-sans">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-900">{r.phone}</td>
                        <td className="px-4 py-2.5 font-sans">
                          {r.isClaimableDuplicate ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                              <AlertTriangle className="w-3 h-3 text-amber-600" /> Existing in CRM
                            </span>
                          ) : r.isOwnDuplicate ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              <XCircle className="w-3 h-3 text-slate-400" /> Already In Your Queue
                            </span>
                          ) : !r.isValid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3" /> Invalid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Ready to Import
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-sans text-xs">
                          {r.isClaimableDuplicate ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleClaimPhone(r.phone)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                                  selectedClaimablePhones.includes(r.phone)
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                                }`}
                              >
                                {selectedClaimablePhones.includes(r.phone) ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3 text-white" />
                                    <span>Selected to Claim</span>
                                  </>
                                ) : (
                                  <>
                                    <PlusCircle className="w-3 h-3 text-amber-700" />
                                    <span>Claim &amp; Include</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  if (!user) return;
                                  const dup = await ContactService.checkPhoneDuplicate(r.phone, user);
                                  if (dup.intelligence) {
                                    setClaimIntelligence(dup.intelligence);
                                    setClaimModalOpen(true);
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 cursor-pointer"
                                title="Inspect previous call & order history"
                              >
                                <Eye className="w-3 h-3 text-blue-600" />
                                <span>Inspect Activity</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px]">{r.reason || 'Brand new number'}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50/80">
              <div className="text-xs text-slate-600 text-center sm:text-left">
                <span>Saving will add </span>
                <strong className="text-emerald-700 font-bold">{totalSelectedToImport} numbers</strong>
                <span> directly to your personal calling queue.</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setImportSummary(null);
                    setFile(null);
                    setBulkText('');
                    setExecuteFn(null);
                    setSelectedClaimablePhones([]);
                  }}
                  className="flex-1 sm:flex-initial"
                >
                  Discard
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={handleOpenBulkConfirmModal}
                  isLoading={isImporting}
                  disabled={totalSelectedToImport === 0}
                  className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 font-bold text-xs sm:text-sm cursor-pointer shadow-xs"
                >
                  Confirm
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Duplicate Number Claim Warning Dialog */}
      <Dialog
        isOpen={claimModalOpen}
        onClose={() => {
          setClaimModalOpen(false);
          setClaimIntelligence(null);
        }}
        title="Existing Number Detected in CRM"
        description="This phone number already exists in the system database. Review its previous activity before claiming."
        maxWidth="lg"
      >
        {claimIntelligence && (
          <div className="space-y-4">
            {/* Warning Alert Banner */}
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 text-amber-950 text-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-sm font-bold text-amber-900">
                  ⚠ Phone Number {claimIntelligence.phone} is already recorded
                </strong>
                <p className="mt-0.5 text-amber-800">
                  This number exists in the CRM and was previously assigned to another team specialist. By default, it will not be added unless you explicitly confirm to associate it with your personal queue.
                </p>
              </div>
            </div>

            {/* Ownership & Call History Info Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 text-[11px] block">Previous / Current Assigned Rep</span>
                <strong className="text-slate-900 text-sm mt-0.5 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-blue-600" />
                  <span>{claimIntelligence.assignedMemberName}</span>
                  <span className="text-xs text-slate-500 font-normal">({claimIntelligence.teamName})</span>
                </strong>
              </div>

              <div>
                <span className="text-slate-400 text-[11px] block">Last Called Date &amp; Time</span>
                <span className="text-slate-800 font-mono text-xs mt-1 block flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {claimIntelligence.lastCalledAt
                      ? format(new Date(claimIntelligence.lastCalledAt), 'MMM dd, yyyy HH:mm')
                      : 'Never Called'}
                  </span>
                </span>
              </div>

              <div>
                <span className="text-slate-400 text-[11px] block">Last Call Status</span>
                <div className="mt-1">
                  {claimIntelligence.lastCallStatus ? (
                    <StatusBadge type="contact" status={claimIntelligence.lastCallStatus as any} />
                  ) : (
                    <span className="text-slate-400 italic">No status recorded</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[11px] block">Existing Customer Name</span>
                <span className="text-slate-900 font-semibold mt-1 block">
                  {claimIntelligence.lastCustomerName || 'None'}
                </span>
              </div>
            </div>

            {/* Previous Call Remarks */}
            {claimIntelligence.lastCallRemarks && (
              <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-1">
                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                  <span>Previous Call Notes</span>
                </div>
                <p className="text-slate-800 italic">"{claimIntelligence.lastCallRemarks}"</p>
              </div>
            )}

            {/* Previous Order History if any */}
            {claimIntelligence.previousOrders && claimIntelligence.previousOrders.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <div className="p-2.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-purple-600" />
                  <span>Previous Order History ({claimIntelligence.previousOrders.length})</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto">
                  {claimIntelligence.previousOrders.map((ord) => (
                    <div key={ord.id} className="p-2.5 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="font-mono font-bold text-blue-700">#{ord.orderNumber}</span>
                        <span className="text-slate-400 text-[11px] ml-2">
                          by {ord.teamMemberName || 'Rep'} on {format(new Date(ord.createdAt), 'yyyy-MM-dd')}
                        </span>
                        <div className="text-slate-600 text-[11px] mt-0.5">{ord.itemsDescription}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge type="order" status={ord.status} />
                        <span className="font-mono font-bold text-slate-900">{formatCurrency(ord.totalAmount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons: Reject vs Confirm */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setClaimModalOpen(false);
                  setClaimIntelligence(null);
                }}
                className="cursor-pointer"
              >
                Reject
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleInitiateClaim}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                Proceed to Code Confirmation
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Reusable Contact Code Confirmation Modal */}
      <ContactCodeConfirmationModal
        isOpen={codeModalOpen}
        onClose={() => {
          setCodeModalOpen(false);
          setPendingContactInfo(null);
        }}
        contactInfo={pendingContactInfo}
        onConfirm={handleConfirmWithCode}
        isSubmitting={isClaiming}
      />
    </div>
  );
};
