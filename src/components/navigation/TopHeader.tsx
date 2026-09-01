import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getTeamBranding } from '../../config/branding';
import { ProfileAvatar } from '../shared/ProfileAvatar';
import { InboundCallbackDialog } from '../calling/InboundCallbackDialog';
import { PostCallModal } from '../calling/PostCallModal';
import { Contact } from '../../models/domain';
import { Calendar, LogOut, User as UserIcon, ChevronDown, PhoneIncoming } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export const TopHeader: React.FC = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isInboundOpen, setIsInboundOpen] = useState(false);
  const [selectedCallbackContact, setSelectedCallbackContact] = useState<Contact | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const teamBrand = getTeamBranding(user.team || user.teamId);

  const getProfilePath = () => {
    switch (role) {
      case 'SUPERVISOR':
        return '/supervisor/profile';
      case 'ADMIN':
        return '/admin/profile';
      case 'FINANCE':
        return '/finance/profile';
      case 'TEAM_MEMBER':
      default:
        return '/member/profile';
    }
  };

  const handleNavigateProfile = () => {
    setIsDropdownOpen(false);
    navigate(getProfilePath());
  };

  const handleLogout = () => {
    setIsDropdownOpen(false);
    logout();
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-14 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Left logo / brand info */}
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 md:hidden"
            style={{ backgroundColor: teamBrand.brandColor }}
          >
            {teamBrand.code.substring(0, 1)}
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-semibold text-slate-900 leading-none">{teamBrand.name}</div>
            <div className="text-[11px] text-slate-500 font-normal mt-0.5">Enterprise Sales & CRM</div>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Inbound Callback Quick Trigger for Team Members and Supervisors */}
          {(role === 'TEAM_MEMBER' || role === 'SUPERVISOR' || role === 'ADMIN') && (
            <button
              type="button"
              onClick={() => setIsInboundOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 shadow-2xs transition-all cursor-pointer"
              title="Look up incoming caller phone number and record call outcome"
            >
              <PhoneIncoming className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span className="hidden sm:inline">Inbound Callback</span>
            </button>
          )}

          {/* Date indicator */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{format(new Date(), 'MMM dd, yyyy')}</span>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* User profile dropdown button in top right corner */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              aria-label="User Profile Menu"
              aria-expanded={isDropdownOpen}
            >
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-900 leading-tight">{user.fullName}</span>
                <span className="text-[10px] font-medium text-blue-600 uppercase tracking-wider">{role}</span>
              </div>
              <ProfileAvatar name={user.fullName} avatarUrl={user.avatarUrl} size="sm" />
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Profile Menu Dropdown */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900 truncate">{user.fullName}</p>
                  <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                  <span className="inline-block mt-1 text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 uppercase tracking-wider">
                    {role}
                  </span>
                </div>

                <div className="py-1">
                  <button
                    onClick={handleNavigateProfile}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left font-medium cursor-pointer"
                  >
                    <UserIcon className="w-4 h-4 text-slate-400" />
                    <span>My Profile</span>
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left font-semibold cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-600" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Inbound Callback Search Modal */}
      <InboundCallbackDialog
        isOpen={isInboundOpen}
        onClose={() => setIsInboundOpen(false)}
        onSelectContactForCallback={(contact) => {
          setSelectedCallbackContact(contact);
        }}
      />

      {/* Global Callback Outcome Form */}
      {selectedCallbackContact && (
        <PostCallModal
          isOpen={!!selectedCallbackContact}
          onClose={() => setSelectedCallbackContact(null)}
          contact={selectedCallbackContact}
          initialDirection="INBOUND"
          onSuccess={() => {
            setSelectedCallbackContact(null);
            window.dispatchEvent(new CustomEvent('crm:contact-updated'));
          }}
        />
      )}
    </>
  );
};
