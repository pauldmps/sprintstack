import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class SprintsService {
  constructor(private readonly prismaService: PrismaService) {}

  findAllByProjectId(projectId: string) {
    return this.prismaService.sprint.findMany({
      where: {
        projectId,
      },
      orderBy: { startDate: 'asc' },
    });
  }

  findById(id: string) {
    return this.prismaService.sprint.findUnique({
      where: {
        id,
      },
    });
  }

  findCurrentByProjectId(projectId: string) {
    return this.prismaService.sprint.findFirst({
      where: {
        projectId,
        state: 'active',
      },
    });
  }

  /**
   * Time off isn't copied in: it lives in TimeOff, and SprintCapacity only holds the days people
   * change by hand. The Team page works out availability from both.
   */
  create(projectId: string, name: string, startDate: Date, endDate: Date) {
    return this.prismaService.sprint.create({
      data: { projectId, name, startDate, endDate },
    });
  }
}
