import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { StorageService } from '@/storage/storage.service';
import { Prisma } from '../generated/prisma/client';
import type { ProjectRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateHoliday,
  SetSprintCapacity,
  TimeOffEntry,
  UpdateHoliday,
  UpdateTeamMember,
} from './team.schema';

/** The signed-in person and their active organization. */
export interface Viewer {
  organizationId: string;
  userId: string;
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const conflict = (message: string) =>
  new GraphQLError(message, { extensions: { code: 'CONFLICT' } });

/** An ISO date as the midnight-UTC Date Prisma writes to a date column, and back. */
const fromISODate = (date: string) => new Date(`${date}T00:00:00.000Z`);
const toISODate = (date: Date) => date.toISOString().slice(0, 10);

const MEMBER_SELECT = {
  userId: true,
  role: true,
  title: true,
  estimates: true,
  createdAt: true,
  user: { select: { name: true, email: true, image: true, jobTitle: true } },
} as const;

type MemberRow = Prisma.ProjectMemberGetPayload<{ select: typeof MEMBER_SELECT }>;

const toHoliday = ({ id, date, name }: { id: string; date: Date; name: string }) => ({
  id,
  date: toISODate(date),
  name,
});

const toTimeOff = <T extends { startDate: Date; endDate: Date }>(entry: T) => ({
  ...entry,
  startDate: toISODate(entry.startDate),
  endDate: toISODate(entry.endDate),
});

const TIME_OFF_SELECT = {
  id: true,
  userId: true,
  type: true,
  startDate: true,
  endDate: true,
} as const;

/**
 * A project's team: its members, the holiday calendar, their time off and per-sprint capacity
 * adjustments. Everyone on the project can read it. Admins manage the team and the calendar;
 * a person's own time off, title and capacity can also be changed by them.
 */
@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  // ---------------------------------------------------------------------------------------------
  // Members
  // ---------------------------------------------------------------------------------------------

  /** The project's members, by name. */
  async listMembers(viewer: Viewer, projectId: string) {
    await this.roleOf(viewer, projectId);
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      select: MEMBER_SELECT,
      orderBy: [{ user: { name: 'asc' } }, { userId: 'asc' }],
    });
    return Promise.all(members.map((member) => this.toMember(member)));
  }

  /** Adds someone from the organization to the project. Admins only. */
  async addMember(viewer: Viewer, projectId: string, userId: string, role: ProjectRole) {
    await this.requireAdmin(viewer, projectId);

    const inOrganization = await this.prisma.member.findFirst({
      where: { organizationId: viewer.organizationId, userId },
      select: { id: true },
    });
    if (!inOrganization) throw new NotFoundException('That person isn’t in this organization.');

    try {
      const member = await this.prisma.projectMember.create({
        data: { projectId, userId, role },
        select: MEMBER_SELECT,
      });
      return this.toMember(member);
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('They’re already on this project.');
      throw error;
    }
  }

  /** Admins change anyone; people change their own title and estimates, but not their role. */
  async updateMember(viewer: Viewer, projectId: string, input: UpdateTeamMember) {
    const viewerRole = await this.roleOf(viewer, projectId);
    const isAdmin = viewerRole === 'admin';
    const isSelf = input.userId === viewer.userId;

    if (input.role !== undefined && !isAdmin) {
      throw new ForbiddenException('Only admins can change roles.');
    }
    if (!isAdmin && !isSelf) {
      throw new ForbiddenException('Only admins can change other members.');
    }

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: input.userId } },
        select: { role: true },
      });
      if (!current) throw new NotFoundException('They aren’t on this project.');

      if (current.role === 'admin' && input.role && input.role !== 'admin') {
        await this.assertAnotherAdmin(tx, projectId, input.userId);
      }

      const member = await tx.projectMember.update({
        where: { projectId_userId: { projectId, userId: input.userId } },
        data: {
          ...(input.role !== undefined && { role: input.role }),
          ...(input.title !== undefined && { title: input.title }),
          ...(input.estimates !== undefined && { estimates: input.estimates }),
        },
        select: MEMBER_SELECT,
      });
      return this.toMember(member);
    });
  }

  /** Takes someone off the project. Admins only, and never the last admin. */
  async removeMember(viewer: Viewer, projectId: string, userId: string) {
    await this.requireAdmin(viewer, projectId);

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
        select: { role: true },
      });
      if (!current) throw new NotFoundException('They aren’t on this project.');
      if (current.role === 'admin') await this.assertAnotherAdmin(tx, projectId, userId);

      await tx.sprintCapacity.deleteMany({ where: { userId, sprint: { projectId } } });
      await tx.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
      return userId;
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Holidays
  // ---------------------------------------------------------------------------------------------

  /** The project's holidays, earliest first, optionally within [from, to]. */
  async listHolidays(viewer: Viewer, projectId: string, from?: string, to?: string) {
    await this.roleOf(viewer, projectId);
    const holidays = await this.prisma.holiday.findMany({
      where: {
        projectId,
        ...((from || to) && {
          date: {
            ...(from && { gte: fromISODate(from) }),
            ...(to && { lte: fromISODate(to) }),
          },
        }),
      },
      orderBy: { date: 'asc' },
    });
    return holidays.map(toHoliday);
  }

  async createHoliday(viewer: Viewer, projectId: string, input: CreateHoliday) {
    await this.requireAdmin(viewer, projectId);
    try {
      const holiday = await this.prisma.holiday.create({
        data: { projectId, name: input.name, date: fromISODate(input.date) },
      });
      return toHoliday(holiday);
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict(`${input.date} is already a holiday.`);
      throw error;
    }
  }

  async updateHoliday(viewer: Viewer, id: string, input: UpdateHoliday) {
    const { projectId } = await this.findHoliday(viewer, id);
    await this.requireAdmin(viewer, projectId);
    try {
      const holiday = await this.prisma.holiday.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.date !== undefined && { date: fromISODate(input.date) }),
        },
      });
      return toHoliday(holiday);
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict(`${input.date} is already a holiday.`);
      throw error;
    }
  }

  async deleteHoliday(viewer: Viewer, id: string) {
    const { projectId } = await this.findHoliday(viewer, id);
    await this.requireAdmin(viewer, projectId);
    await this.prisma.holiday.delete({ where: { id } });
    return id;
  }

  // ---------------------------------------------------------------------------------------------
  // Time off
  // ---------------------------------------------------------------------------------------------

  /** Time off of the project's members that touches [from, to], earliest first. */
  async listTimeOff(viewer: Viewer, projectId: string, from?: string, to?: string) {
    await this.roleOf(viewer, projectId);
    const entries = await this.prisma.timeOff.findMany({
      where: {
        organizationId: viewer.organizationId,
        user: { projects: { some: { projectId } } },
        ...(to && { startDate: { lte: fromISODate(to) } }),
        ...(from && { endDate: { gte: fromISODate(from) } }),
      },
      select: TIME_OFF_SELECT,
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
    });
    return entries.map(toTimeOff);
  }

  /** Books time off for someone on the project: themselves, or anyone if an admin. */
  async createTimeOff(viewer: Viewer, projectId: string, input: TimeOffEntry) {
    await this.requireSelfOrAdmin(viewer, projectId, input.userId);
    const entry = await this.prisma.timeOff.create({
      data: {
        organizationId: viewer.organizationId,
        userId: input.userId,
        type: input.type,
        startDate: fromISODate(input.startDate),
        endDate: fromISODate(input.endDate),
      },
      select: TIME_OFF_SELECT,
    });
    return toTimeOff(entry);
  }

  /**
   * Changes an entry. Both its current owner and the new one must be people the viewer may book
   * for on this project.
   */
  async updateTimeOff(viewer: Viewer, projectId: string, id: string, input: TimeOffEntry) {
    const existing = await this.findTimeOff(viewer, id);
    await this.requireSelfOrAdmin(viewer, projectId, existing.userId);
    if (input.userId !== existing.userId) {
      await this.requireSelfOrAdmin(viewer, projectId, input.userId);
    }
    const entry = await this.prisma.timeOff.update({
      where: { id },
      data: {
        userId: input.userId,
        type: input.type,
        startDate: fromISODate(input.startDate),
        endDate: fromISODate(input.endDate),
      },
      select: TIME_OFF_SELECT,
    });
    return toTimeOff(entry);
  }

  async deleteTimeOff(viewer: Viewer, projectId: string, id: string) {
    const existing = await this.findTimeOff(viewer, id);
    await this.requireSelfOrAdmin(viewer, projectId, existing.userId);
    await this.prisma.timeOff.delete({ where: { id } });
    return id;
  }

  // ---------------------------------------------------------------------------------------------
  // Sprint capacity
  // ---------------------------------------------------------------------------------------------

  /** Hand-made adjustments for the project's sprints, or just one sprint's. */
  async listSprintCapacities(viewer: Viewer, projectId: string, sprintId?: string) {
    await this.roleOf(viewer, projectId);
    const rows = await this.prisma.sprintCapacity.findMany({
      where: { sprint: { projectId, ...(sprintId && { id: sprintId }) } },
      orderBy: [{ sprintId: 'asc' }, { userId: 'asc' }],
    });
    return rows.map((row) => ({ ...row, adjustmentDays: row.adjustmentDays.toNumber() }));
  }

  /** Sets a member's adjustment for a sprint; zero removes it. Themselves, or anyone if an admin. */
  async setSprintCapacity(viewer: Viewer, input: SetSprintCapacity) {
    const { sprintId, userId, adjustmentDays } = input;
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, project: this.visibleProject(viewer) },
      select: { projectId: true },
    });
    if (!sprint) throw new NotFoundException('Sprint not found.');
    await this.requireSelfOrAdmin(viewer, sprint.projectId, userId);

    if (adjustmentDays === 0) {
      await this.prisma.sprintCapacity.deleteMany({ where: { sprintId, userId } });
      return { sprintId, userId, adjustmentDays: 0 };
    }

    const row = await this.prisma.sprintCapacity.upsert({
      where: { sprintId_userId: { sprintId, userId } },
      create: { sprintId, userId, adjustmentDays },
      update: { adjustmentDays },
    });
    return { ...row, adjustmentDays: row.adjustmentDays.toNumber() };
  }

  // ---------------------------------------------------------------------------------------------
  // Access
  // ---------------------------------------------------------------------------------------------

  private visibleProject({ organizationId, userId }: Viewer) {
    return { organizationId, archivedAt: null, members: { some: { userId } } };
  }

  /** The viewer's role on the project. A project they can't see reads as not found. */
  private async roleOf(viewer: Viewer, projectId: string) {
    const membership = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: viewer.userId,
        project: { organizationId: viewer.organizationId, archivedAt: null },
      },
      select: { role: true },
    });
    if (!membership) throw new NotFoundException('Project not found.');
    return membership.role;
  }

  private async requireAdmin(viewer: Viewer, projectId: string) {
    if ((await this.roleOf(viewer, projectId)) !== 'admin') {
      throw new ForbiddenException('Only project admins can do that.');
    }
  }

  /** The target must be on the project, and be the viewer unless the viewer is an admin. */
  private async requireSelfOrAdmin(viewer: Viewer, projectId: string, userId: string) {
    const role = await this.roleOf(viewer, projectId);
    if (userId !== viewer.userId && role !== 'admin') {
      throw new ForbiddenException('Only admins can change someone else’s availability.');
    }
    if (userId !== viewer.userId) {
      const target = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
        select: { userId: true },
      });
      if (!target) throw new NotFoundException('They aren’t on this project.');
    }
  }

  private async assertAnotherAdmin(
    tx: Prisma.TransactionClient,
    projectId: string,
    userId: string,
  ) {
    const others = await tx.projectMember.count({
      where: { projectId, role: 'admin', userId: { not: userId } },
    });
    if (others === 0) throw new ForbiddenException('A project needs at least one admin.');
  }

  /** A holiday on a project the viewer can see. */
  private async findHoliday(viewer: Viewer, id: string) {
    const holiday = await this.prisma.holiday.findFirst({
      where: { id, project: this.visibleProject(viewer) },
      select: { projectId: true },
    });
    if (!holiday) throw new NotFoundException('Holiday not found.');
    return holiday;
  }

  /** An entry in the viewer's organization. */
  private async findTimeOff(viewer: Viewer, id: string) {
    const entry = await this.prisma.timeOff.findFirst({
      where: { id, organizationId: viewer.organizationId },
      select: { userId: true },
    });
    if (!entry) throw new NotFoundException('Time off not found.');
    return entry;
  }

  /** A stored photo's key becomes a signed link; GitHub accounts already hold a full URL. */
  private async imageUrl(image: string | null) {
    if (!image) return null;
    return /^https?:\/\//.test(image) ? image : this.storageService.getFileDownloadUrl(image);
  }

  private async toMember({ userId, role, title, estimates, createdAt, user }: MemberRow) {
    return {
      userId,
      role,
      estimates,
      name: user.name,
      email: user.email,
      title: title ?? user.jobTitle,
      image: await this.imageUrl(user.image),
      joinedAt: createdAt,
    };
  }
}
