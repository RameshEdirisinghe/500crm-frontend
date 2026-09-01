import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { User, UserRole, Team } from '../../models/domain';
import { userRepository, teamRepository } from '../../repositories';
import { UserService } from '../../services/userService';
import { PageHeader } from '../../components/shared/PageHeader';
import { SearchInput } from '../../components/shared/SearchInput';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ProfileAvatar } from '../../components/shared/ProfileAvatar';
import { EditableProfileAvatar } from '../../components/shared/EditableProfileAvatar';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { LoadingState } from '../../components/shared/LoadingState';
import toast from 'react-hot-toast';
import { UserPlus, Edit2, UserX, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AdminUsersPage: React.FC = () => {
  const { user, updateCurrentUser } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Add/Edit User Dialog State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form Fields
  const [role, setRole] = useState<UserRole>('SUPERVISOR');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [teamId, setTeamId] = useState<string>('');
  const [supervisorId, setSupervisorId] = useState<string>('');
  const [nic, setNic] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('1995-05-15');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Disable Dialog
  const [disablingId, setDisablingId] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [usersData, teamsData] = await Promise.all([
        userRepository.getAll(),
        teamRepository.getAll().catch(() => []),
      ]);
      setUsers(usersData);
      setTeams(teamsData);
      if (teamsData.length > 0 && !teamId) {
        setTeamId(teamsData[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openAddModal = () => {
    setEditingUser(null);
    setRole('SUPERVISOR');
    setFullName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPhone('');
    setTeamId(teams.length > 0 ? teams[0].id : '');
    setSupervisorId('');
    setNic('');
    setDateOfBirth('1995-05-15');
    setAvatarUrl('');
    setIsModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setRole(u.role);
    setFullName(u.fullName);
    setEmail(u.email);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPhone(u.phone);
    setTeamId(u.teamId || (teams.length > 0 ? teams[0].id : ''));
    setSupervisorId(u.supervisorId || '');
    setNic(u.nic || '');
    setDateOfBirth(u.dateOfBirth || '1995-05-15');
    setAvatarUrl(u.avatarUrl || '');
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;

    if (!editingUser) {
      if (!password) {
        toast.error('Please enter a password');
        return;
      }
      if (password.length < 10) {
        toast.error('Password must be at least 10 characters long');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('Passwords do not match. Please re-enter your password.');
        return;
      }
    } else {
      // If editing and password was entered
      if (password.trim().length > 0) {
        if (password.trim().length < 10) {
          toast.error('New password must be at least 10 characters long');
          return;
        }
        if (password !== confirmPassword) {
          toast.error('Passwords do not match. Please re-enter your password.');
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      if (editingUser) {
        const updated = await UserService.updateUser(
          editingUser.id,
          {
            fullName,
            email,
            password: password.trim() ? password.trim() : undefined,
            phone,
            role,
            teamId: role === 'ADMIN' || role === 'FINANCE' ? null : (teamId || null),
            supervisorId: role === 'TEAM_MEMBER' ? (supervisorId || null) : null,
            nic,
            dateOfBirth,
            avatarUrl,
          },
          user!
        );
        if (editingUser.id === user?.id) {
          updateCurrentUser(updated);
        }
        toast.success(`Updated details for ${fullName}`);
      } else {
        await UserService.createUser(
          {
            username: email.split('@')[0],
            email,
            password,
            fullName,
            role,
            teamId: role === 'ADMIN' || role === 'FINANCE' ? null : (teamId || null),
            supervisorId: role === 'TEAM_MEMBER' ? (supervisorId || null) : null,
            phone,
            nic,
            dateOfBirth,
            avatarUrl: '', // No attached photo during creation
            joiningDate: new Date().toISOString(),
            isActive: true,
          },
          user!
        );
        toast.success(`Created new ${role} account for ${fullName}`);
      }
      setIsModalOpen(false);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisableConfirm = async () => {
    if (!disablingId || !user) return;
    try {
      await UserService.disableUser(disablingId, user);
      toast.success('User account has been disabled.');
      setDisablingId(null);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to disable user.');
    }
  };

  const supervisors = users.filter((u) => u.role === 'SUPERVISOR' && u.teamId === teamId);
  const teamsMap = teams.reduce<Record<string, Team>>((map, team) => {
    map[team.id] = team;
    return map;
  }, {});

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.phone.includes(search);
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) return <LoadingState rows={8} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="User & Employee Directory"
        description="Manage system users, supervisors, agents, and finance officers"
        actions={
          <Button variant="primary" leftIcon={<UserPlus className="w-4 h-4" />} onClick={openAddModal}>
            Add User
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email, or phone..." />
        </div>
        <div className="w-full sm:w-60">
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All System Roles' },
              { value: 'ADMIN', label: 'Administrators' },
              { value: 'SUPERVISOR', label: 'Supervisors' },
              { value: 'TEAM_MEMBER', label: 'Team Members' },
              { value: 'FINANCE', label: 'Finance Users' },
            ]}
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="enterprise-table-container">
        <table className="w-full text-left text-sm text-slate-700">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Assigned Team</th>
              <th className="py-3 px-4">Phone Number</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <ProfileAvatar name={u.fullName} avatarUrl={u.avatarUrl} size="sm" />
                    <div>
                      <div className="font-semibold text-slate-900">{u.fullName}</div>
                      <div className="text-xs text-slate-400 font-mono">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                    {u.role}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-xs text-slate-600">
                  {u.team?.name || (u.teamId ? teamsMap[u.teamId]?.name || u.teamId : 'System Wide')}
                </td>
                <td className="py-3.5 px-4 text-xs font-mono text-slate-800">
                  {u.phone}
                </td>
                <td className="py-3.5 px-4">
                  <StatusBadge type="user" status={String(u.isActive)} />
                </td>
                <td className="py-3.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Eye className="w-3.5 h-3.5" />}
                      onClick={() => navigate(`/admin/users/${u.id}`)}
                    >
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                      onClick={() => openEditModal(u)}
                    >
                      Edit
                    </Button>
                    {u.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        leftIcon={<UserX className="w-3.5 h-3.5" />}
                        onClick={() => setDisablingId(u.id)}
                      >
                        Disable
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? 'Edit User Account' : 'Create User Account'}
      >
        <form onSubmit={handleSaveUser} className="space-y-4" autoComplete="off">
          {editingUser && (
            <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <EditableProfileAvatar
                name={fullName || 'User'}
                avatarUrl={avatarUrl}
                onChangeAvatar={setAvatarUrl}
                size="lg"
              />
              <div>
                <div className="text-xs font-bold text-slate-900">User Photo</div>
                <div className="text-[11px] text-slate-500">Click camera icon to upload profile photo</div>
              </div>
            </div>
          )}

          <Select
            label="System Role *"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            options={[
              { value: 'SUPERVISOR', label: 'Supervisor' },
              { value: 'TEAM_MEMBER', label: 'Team Member' },
              { value: 'FINANCE', label: 'Finance User' },
              { value: 'ADMIN', label: 'Administrator' },
            ]}
          />

          <Input label="Full Name *" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="off" />
          <Input label="Email Address *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
          
          <Input
            label={editingUser ? "Reset / Change Password" : "Account Password *"}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={editingUser ? "Leave blank to keep current, or enter new password" : "Enter password (min. 10 chars)"}
            helperText={editingUser ? (password ? "Must be at least 10 characters" : "Leave blank to keep existing password") : "Must be at least 10 characters"}
            autoComplete="new-password"
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            required={!editingUser}
          />

          {(!editingUser || password.length > 0) && (
            <Input
              label={editingUser ? "Confirm New Password *" : "Confirm Password *"}
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              helperText={confirmPassword && password !== confirmPassword ? 'Passwords do not match' : undefined}
              error={confirmPassword && password !== confirmPassword ? 'Passwords do not match' : undefined}
              autoComplete="new-password"
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="p-1 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              required
            />
          )}

          <Input label="Phone Number *" value={phone} onChange={(e) => setPhone(e.target.value)} required />

          {(role === 'SUPERVISOR' || role === 'TEAM_MEMBER') && (
            <Select
              label="Assigned Brand / Team *"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              options={teams.map((t) => ({ value: t.id, label: `${t.name} (${t.code})` }))}
            />
          )}

          {role === 'TEAM_MEMBER' && (
            <Select
              label="Assigned Supervisor *"
              value={supervisorId}
              onChange={(e) => setSupervisorId(e.target.value)}
              options={[
                { value: '', label: '-- Select Supervisor --' },
                ...supervisors.map((s) => ({ value: s.id, label: `${s.fullName} (${s.email})` })),
              ]}
            />
          )}

          <Input label="NIC / National ID" value={nic} onChange={(e) => setNic(e.target.value)} />
          <Input label="Date of Birth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {editingUser ? 'Save Changes' : 'Create Account'}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        isOpen={!!disablingId}
        onClose={() => setDisablingId(null)}
        onConfirm={handleDisableConfirm}
        title="Disable System User Account"
        message="Are you sure you want to disable this user account? Historical statistics and activity logs will be strictly preserved."
        confirmText="Disable Account"
        isDanger
      />
    </div>
  );
};
