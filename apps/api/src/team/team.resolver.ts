import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { GraphQLError } from 'graphql';
import type { Auth } from '@/auth/auth';
import { userIdSchema, uuidSchema } from '@/common.schema';
import { ValidateArgs } from '@/zod-validation.decorator';
import { ProjectRole } from '../generated/prisma/enums';
import {
  CreateHolidayInput,
  SetSprintCapacityInput,
  TimeOffInput,
  UpdateHolidayInput,
  UpdateTeamMemberInput,
} from './team.input';
import { HolidayModel, SprintCapacityModel, TeamMemberModel, TimeOffModel } from './team.model';
import {
  type CreateHoliday,
  createHolidaySchema,
  isoDateSchema,
  type SetSprintCapacity,
  setSprintCapacitySchema,
  type TimeOffEntry,
  timeOffSchema,
  type UpdateHoliday,
  type UpdateTeamMember,
  updateHolidaySchema,
  updateTeamMemberSchema,
} from './team.schema';
import { TeamService, type Viewer } from './team.service';

const optionalDate = isoDateSchema.nullish().transform((value) => value ?? undefined);

/** The signed-in person in their active organization; team data always lives in one. */
const viewerOf = (session: UserSession<Auth>): Viewer => {
  const { activeOrganizationId } = session.session;
  if (!activeOrganizationId) {
    throw new GraphQLError('Choose an organization first.', { extensions: { code: 'FORBIDDEN' } });
  }
  return { organizationId: activeOrganizationId, userId: session.user.id };
};

/** A project's team page: members, holidays, time off and sprint capacity. */
@Resolver(() => TeamMemberModel)
export class TeamResolver {
  constructor(private readonly teamService: TeamService) {}

  // Members --------------------------------------------------------------------------------------

  @Query(() => [TeamMemberModel], { description: 'The project’s members, by name.' })
  @ValidateArgs({ projectId: uuidSchema })
  team(
    @Session() session: UserSession<Auth>,
    @Args('projectId', { type: () => ID }) projectId: string,
  ) {
    return this.teamService.listMembers(viewerOf(session), projectId);
  }

  @Mutation(() => TeamMemberModel, {
    description: 'Adds someone from the organization to the project. Admins only.',
  })
  @ValidateArgs({ projectId: uuidSchema, userId: userIdSchema })
  addTeamMember(
    @Session() session: UserSession<Auth>,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('userId', { type: () => ID }) userId: string,
    @Args('role', { type: () => ProjectRole, defaultValue: ProjectRole.member }) role: ProjectRole,
  ) {
    return this.teamService.addMember(viewerOf(session), projectId, userId, role);
  }

  @Mutation(() => TeamMemberModel, {
    description: 'Changes a member’s role (admins), or title and estimates (admins or themselves).',
  })
  @ValidateArgs({ projectId: uuidSchema, input: updateTeamMemberSchema })
  updateTeamMember(
    @Session() session: UserSession<Auth>,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('input', { type: () => UpdateTeamMemberInput }) input: UpdateTeamMember,
  ) {
    return this.teamService.updateMember(viewerOf(session), projectId, input);
  }

  @Mutation(() => ID, {
    description:
      'Takes someone off the project and returns their id. Admins only; never the last admin.',
  })
  @ValidateArgs({ projectId: uuidSchema, userId: userIdSchema })
  removeTeamMember(
    @Session() session: UserSession<Auth>,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('userId', { type: () => ID }) userId: string,
  ) {
    return this.teamService.removeMember(viewerOf(session), projectId, userId);
  }

  // Holidays -------------------------------------------------------------------------------------

  @Query(() => [HolidayModel], {
    description: 'The project’s holidays, earliest first, optionally between two ISO dates.',
  })
  @ValidateArgs({ projectId: uuidSchema, from: optionalDate, to: optionalDate })
  holidays(
    @Session() session: UserSession<Auth>,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('from', { type: () => String, nullable: true }) from?: string,
    @Args('to', { type: () => String, nullable: true }) to?: string,
  ) {
    return this.teamService.listHolidays(viewerOf(session), projectId, from, to);
  }

  @Mutation(() => HolidayModel, { description: 'Admins only.' })
  @ValidateArgs({ projectId: uuidSchema, input: createHolidaySchema })
  createHoliday(
    @Session() session: UserSession<Auth>,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('input', { type: () => CreateHolidayInput }) input: CreateHoliday,
  ) {
    return this.teamService.createHoliday(viewerOf(session), projectId, input);
  }

  @Mutation(() => HolidayModel, { description: 'Admins only.' })
  @ValidateArgs({ id: uuidSchema, input: updateHolidaySchema })
  updateHoliday(
    @Session() session: UserSession<Auth>,
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateHolidayInput }) input: UpdateHoliday,
  ) {
    return this.teamService.updateHoliday(viewerOf(session), id, input);
  }

  @Mutation(() => ID, { description: 'Admins only. Returns the deleted holiday’s id.' })
  @ValidateArgs({ id: uuidSchema })
  deleteHoliday(@Session() session: UserSession<Auth>, @Args('id', { type: () => ID }) id: string) {
    return this.teamService.deleteHoliday(viewerOf(session), id);
  }

  // Time off -------------------------------------------------------------------------------------

  @Query(() => [TimeOffModel], {
    description: 'Time off of the project’s members, optionally only what touches two ISO dates.',
  })
  @ValidateArgs({ projectId: uuidSchema, from: optionalDate, to: optionalDate })
  teamTimeOff(
    @Session() session: UserSession<Auth>,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('from', { type: () => String, nullable: true }) from?: string,
    @Args('to', { type: () => String, nullable: true }) to?: string,
  ) {
    return this.teamService.listTimeOff(viewerOf(session), projectId, from, to);
  }

  @Mutation(() => TimeOffModel, {
    description: 'Books time off for yourself, or for anyone on the project if an admin.',
  })
  @ValidateArgs({ projectId: uuidSchema, input: timeOffSchema })
  createTimeOff(
    @Session() session: UserSession<Auth>,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('input', { type: () => TimeOffInput }) input: TimeOffEntry,
  ) {
    return this.teamService.createTimeOff(viewerOf(session), projectId, input);
  }

  @Mutation(() => TimeOffModel, { description: 'Your own entries, or anyone’s if an admin.' })
  @ValidateArgs({ projectId: uuidSchema, id: uuidSchema, input: timeOffSchema })
  updateTimeOff(
    @Session() session: UserSession<Auth>,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => TimeOffInput }) input: TimeOffEntry,
  ) {
    return this.teamService.updateTimeOff(viewerOf(session), projectId, id, input);
  }

  @Mutation(() => ID, { description: 'Your own entries, or anyone’s if an admin. Returns the id.' })
  @ValidateArgs({ projectId: uuidSchema, id: uuidSchema })
  deleteTimeOff(
    @Session() session: UserSession<Auth>,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.teamService.deleteTimeOff(viewerOf(session), projectId, id);
  }

  // Sprint capacity ------------------------------------------------------------------------------

  @Query(() => [SprintCapacityModel], {
    description: 'Hand-made capacity adjustments for the project’s sprints, or one sprint’s.',
  })
  @ValidateArgs({ projectId: uuidSchema, sprintId: uuidSchema.nullish() })
  sprintCapacities(
    @Session() session: UserSession<Auth>,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('sprintId', { type: () => ID, nullable: true }) sprintId?: string | null,
  ) {
    return this.teamService.listSprintCapacities(
      viewerOf(session),
      projectId,
      sprintId ?? undefined,
    );
  }

  @Mutation(() => SprintCapacityModel, {
    description:
      'Sets a member’s adjustment for a sprint; zero clears it. Yourself, or anyone if an admin.',
  })
  @ValidateArgs({ input: setSprintCapacitySchema })
  setSprintCapacity(
    @Session() session: UserSession<Auth>,
    @Args('input', { type: () => SetSprintCapacityInput }) input: SetSprintCapacity,
  ) {
    return this.teamService.setSprintCapacity(viewerOf(session), input);
  }
}
