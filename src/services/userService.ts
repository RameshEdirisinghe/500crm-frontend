import { userRepository } from '../repositories';
import { User, UserRole } from '../models/domain';
import { ActivityLogService } from './activityLogService';

export class UserService {
  static async getAllUsers(): Promise<User[]> {
    return userRepository.getAll();
  }

  static async getUserById(id: string): Promise<User | null> {
    return userRepository.getById(id);
  }

  static async getUsersByTeam(teamId: string): Promise<User[]> {
    return userRepository.getByTeamId(teamId);
  }

  static async getUsersBySupervisor(supervisorId: string): Promise<User[]> {
    return userRepository.getBySupervisorId(supervisorId);
  }

  static async createUser(
    userData: Omit<User, 'id' | 'createdAt'>,
    actor: User
  ): Promise<User> {
    const newUser = await userRepository.create(userData);

    await ActivityLogService.logAction({
      userId: actor.id,
      userRole: actor.role,
      userName: actor.fullName,
      teamId: actor.teamId || undefined,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: newUser.id,
      description: `Created user ${newUser.fullName} (${newUser.role})`,
    });

    return newUser;
  }

  static async updateUser(
    id: string,
    updates: Partial<User>,
    actor: User
  ): Promise<User> {
    let updated: User;
    if (id === actor.id) {
      updated = await userRepository.updateMe(updates);
    } else {
      updated = await userRepository.update(id, updates);
    }

    await ActivityLogService.logAction({
      userId: actor.id,
      userRole: actor.role,
      userName: actor.fullName,
      teamId: actor.teamId || undefined,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: updated.id,
      description: `Updated profile details for ${updated.fullName}`,
    });

    return updated;
  }

  static async disableUser(id: string, actor: User): Promise<void> {
    const userToDisable = await userRepository.getById(id);
    if (!userToDisable) throw new Error('User not found');

    await userRepository.disable(id);

    await ActivityLogService.logAction({
      userId: actor.id,
      userRole: actor.role,
      userName: actor.fullName,
      teamId: actor.teamId || undefined,
      action: 'USER_DISABLED',
      entityType: 'User',
      entityId: id,
      description: `Disabled account for ${userToDisable.fullName}`,
    });
  }
}
