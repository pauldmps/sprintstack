import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { SprintsService } from './sprints.service';

describe('SprintsService.create', () => {
  it('creates the sprint without copying time off into capacity adjustments', async () => {
    const prisma = {
      sprint: { create: vi.fn().mockResolvedValue({ id: 's1' }) },
      sprintCapacity: { create: vi.fn() },
      timeOff: { findMany: vi.fn() },
    };
    const service = new SprintsService(prisma as unknown as PrismaService);
    const startDate = new Date('2026-11-16');
    const endDate = new Date('2026-11-29');

    await expect(service.create('p1', 'Sprint 26', startDate, endDate)).resolves.toEqual({
      id: 's1',
    });

    expect(prisma.sprint.create).toHaveBeenCalledWith({
      data: { projectId: 'p1', name: 'Sprint 26', startDate, endDate },
    });
    expect(prisma.timeOff.findMany).not.toHaveBeenCalled();
    expect(prisma.sprintCapacity.create).not.toHaveBeenCalled();
  });
});
