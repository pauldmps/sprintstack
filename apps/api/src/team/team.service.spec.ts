import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorageService } from '../storage/storage.service';
import { TeamService, type Viewer } from './team.service';

const viewer: Viewer = { organizationId: 'org1', userId: 'me' };
const projectId = '0190a000-0000-7000-8000-000000000001';

const makePrisma = () => {
  const prisma = {
    projectMember: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    member: { findFirst: vi.fn() },
    holiday: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    timeOff: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    sprint: { findFirst: vi.fn() },
    sprintCapacity: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((run: (tx: typeof prisma) => unknown) => run(prisma));
  return prisma;
};

let prisma: ReturnType<typeof makePrisma>;
let service: TeamService;

/** The viewer's role on the project, as roleOf reads it. */
const asRole = (role: 'admin' | 'member' | 'viewer') =>
  prisma.projectMember.findFirst.mockResolvedValue({ role });

beforeEach(() => {
  prisma = makePrisma();
  const storage = { getFileDownloadUrl: vi.fn(async (key: string) => `signed:${key}`) };
  service = new TeamService(
    prisma as unknown as PrismaService,
    storage as unknown as StorageService,
  );
});

describe('access', () => {
  it('hides a project the viewer is not on', async () => {
    prisma.projectMember.findFirst.mockResolvedValue(null);
    await expect(service.listMembers(viewer, projectId)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.projectMember.findFirst.mock.calls[0][0].where).toEqual({
      projectId,
      userId: 'me',
      project: { organizationId: 'org1', archivedAt: null },
    });
  });
});

describe('listMembers', () => {
  it('signs stored photos and falls back to the profile job title', async () => {
    asRole('viewer');
    prisma.projectMember.findMany.mockResolvedValue([
      {
        userId: 'u1',
        role: 'member',
        title: null,
        estimates: true,
        createdAt: new Date('2026-01-01'),
        user: { name: 'Mira', email: 'm@x', image: 'avatars/u1/a', jobTitle: 'Engineer' },
      },
      {
        userId: 'u2',
        role: 'admin',
        title: 'Lead',
        estimates: false,
        createdAt: new Date('2026-01-02'),
        user: { name: 'Jonas', email: 'j@x', image: 'https://gh/a.png', jobTitle: 'Engineer' },
      },
    ]);

    const members = await service.listMembers(viewer, projectId);

    expect(members.map((m) => [m.title, m.image])).toEqual([
      ['Engineer', 'signed:avatars/u1/a'],
      ['Lead', 'https://gh/a.png'],
    ]);
  });
});

describe('updateMember', () => {
  it('lets members change their own title but not their role', async () => {
    asRole('member');
    prisma.projectMember.findUnique.mockResolvedValue({ role: 'member' });
    prisma.projectMember.update.mockResolvedValue({
      userId: 'me',
      role: 'member',
      title: 'QA',
      estimates: false,
      createdAt: new Date(),
      user: { name: 'Me', email: 'me@x', image: null, jobTitle: null },
    });

    await service.updateMember(viewer, projectId, { userId: 'me', title: 'QA', estimates: false });
    expect(prisma.projectMember.update.mock.calls[0][0].data).toEqual({
      title: 'QA',
      estimates: false,
    });

    await expect(
      service.updateMember(viewer, projectId, { userId: 'me', role: 'admin' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('stops members changing someone else', async () => {
    asRole('member');
    await expect(
      service.updateMember(viewer, projectId, { userId: 'u2', title: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('never demotes the last admin', async () => {
    asRole('admin');
    prisma.projectMember.findUnique.mockResolvedValue({ role: 'admin' });
    prisma.projectMember.count.mockResolvedValue(0);
    await expect(
      service.updateMember(viewer, projectId, { userId: 'me', role: 'member' }),
    ).rejects.toThrow('at least one admin');
    expect(prisma.projectMember.update).not.toHaveBeenCalled();
  });
});

describe('removeMember', () => {
  it('requires an admin', async () => {
    asRole('member');
    await expect(service.removeMember(viewer, projectId, 'u2')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('clears their sprint adjustments on the project', async () => {
    asRole('admin');
    prisma.projectMember.findUnique.mockResolvedValue({ role: 'member' });
    await expect(service.removeMember(viewer, projectId, 'u2')).resolves.toBe('u2');
    expect(prisma.sprintCapacity.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u2', sprint: { projectId } },
    });
    expect(prisma.projectMember.delete).toHaveBeenCalled();
  });
});

describe('addMember', () => {
  it('only adds people from the organization', async () => {
    asRole('admin');
    prisma.member.findFirst.mockResolvedValue(null);
    await expect(service.addMember(viewer, projectId, 'stranger', 'member')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reports someone already on the project as a conflict', async () => {
    asRole('admin');
    prisma.member.findFirst.mockResolvedValue({ id: 'm1' });
    prisma.projectMember.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
    );
    const error = await service.addMember(viewer, projectId, 'u2', 'member').catch((e) => e);
    expect(error).toBeInstanceOf(GraphQLError);
    expect((error as GraphQLError).extensions.code).toBe('CONFLICT');
  });
});

describe('holidays', () => {
  it('stores and returns ISO dates without shifting them', async () => {
    asRole('admin');
    prisma.holiday.create.mockImplementation(async ({ data }) => ({ id: 'h1', ...data }));
    const holiday = await service.createHoliday(viewer, projectId, {
      date: '2026-10-30',
      name: 'Company holiday',
    });
    expect(prisma.holiday.create.mock.calls[0][0].data.date.toISOString()).toBe(
      '2026-10-30T00:00:00.000Z',
    );
    expect(holiday).toEqual({ id: 'h1', date: '2026-10-30', name: 'Company holiday' });
  });

  it('are changed by admins only', async () => {
    asRole('member');
    await expect(
      service.createHoliday(viewer, projectId, { date: '2026-10-30', name: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('time off', () => {
  const entry = {
    userId: 'me',
    type: 'vacation' as const,
    startDate: '2026-10-26',
    endDate: '2026-10-29',
  };

  it('lists entries of project members overlapping the window', async () => {
    asRole('viewer');
    prisma.timeOff.findMany.mockResolvedValue([]);
    await service.listTimeOff(viewer, projectId, '2026-10-19', '2026-11-01');
    expect(prisma.timeOff.findMany.mock.calls[0][0].where).toEqual({
      organizationId: 'org1',
      user: { projects: { some: { projectId } } },
      startDate: { lte: new Date('2026-11-01T00:00:00.000Z') },
      endDate: { gte: new Date('2026-10-19T00:00:00.000Z') },
    });
  });

  it('lets anyone on the project book their own', async () => {
    asRole('viewer');
    prisma.timeOff.create.mockImplementation(async ({ data }) => ({ id: 't1', ...data }));
    const saved = await service.createTimeOff(viewer, projectId, entry);
    expect(saved).toMatchObject({ startDate: '2026-10-26', endDate: '2026-10-29' });
    expect(prisma.timeOff.create.mock.calls[0][0].data.organizationId).toBe('org1');
  });

  it('only lets admins book for others, and only for people on the project', async () => {
    asRole('member');
    await expect(
      service.createTimeOff(viewer, projectId, { ...entry, userId: 'u2' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    asRole('admin');
    prisma.projectMember.findUnique.mockResolvedValue(null);
    await expect(
      service.createTimeOff(viewer, projectId, { ...entry, userId: 'u2' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('stops members deleting someone else’s entry', async () => {
    asRole('member');
    prisma.timeOff.findFirst.mockResolvedValue({ userId: 'u2' });
    await expect(service.deleteTimeOff(viewer, projectId, 't1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.timeOff.delete).not.toHaveBeenCalled();
  });
});

describe('setSprintCapacity', () => {
  const sprintId = '0190a000-0000-7000-8000-000000000002';

  it('upserts an adjustment and returns it as a number', async () => {
    prisma.sprint.findFirst.mockResolvedValue({ projectId });
    asRole('member');
    prisma.sprintCapacity.upsert.mockResolvedValue({
      sprintId,
      userId: 'me',
      adjustmentDays: new Prisma.Decimal(-1.5),
    });
    await expect(
      service.setSprintCapacity(viewer, { sprintId, userId: 'me', adjustmentDays: -1.5 }),
    ).resolves.toEqual({ sprintId, userId: 'me', adjustmentDays: -1.5 });
  });

  it('removes the row when set to zero', async () => {
    prisma.sprint.findFirst.mockResolvedValue({ projectId });
    asRole('member');
    await service.setSprintCapacity(viewer, { sprintId, userId: 'me', adjustmentDays: 0 });
    expect(prisma.sprintCapacity.deleteMany).toHaveBeenCalledWith({
      where: { sprintId, userId: 'me' },
    });
    expect(prisma.sprintCapacity.upsert).not.toHaveBeenCalled();
  });

  it('hides sprints of projects the viewer can’t see', async () => {
    prisma.sprint.findFirst.mockResolvedValue(null);
    await expect(
      service.setSprintCapacity(viewer, { sprintId, userId: 'me', adjustmentDays: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
