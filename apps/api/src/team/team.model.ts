import { Field, Float, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ProjectRole, TimeOffType } from '../generated/prisma/enums';

registerEnumType(ProjectRole, { name: 'ProjectRole' });
registerEnumType(TimeOffType, { name: 'TimeOffType' });

/** Someone on a project's team, as the Team page lists them. */
@ObjectType('TeamMember')
export class TeamMemberModel {
  @Field(() => ID)
  userId: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field(() => String, { nullable: true, description: 'A signed link to their photo.' })
  image?: string | null;

  @Field(() => ProjectRole)
  role: ProjectRole;

  @Field(() => String, {
    nullable: true,
    description: 'Job title on this project, falling back to their profile’s job title.',
  })
  title?: string | null;

  @Field({
    description: 'Takes story points. Design and QA don’t, so they have days but no points.',
  })
  estimates: boolean;

  @Field()
  joinedAt: Date;
}

/** A non-working day on the project's calendar, on top of weekends. */
@ObjectType('Holiday')
export class HolidayModel {
  @Field(() => ID)
  id: string;

  @Field({ description: 'ISO date, e.g. 2026-10-30.' })
  date: string;

  @Field()
  name: string;
}

/** Someone's days off. Shared across every project in the organization. */
@ObjectType('TimeOff')
export class TimeOffModel {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field(() => TimeOffType)
  type: TimeOffType;

  @Field({ description: 'First day off, as an ISO date.' })
  startDate: string;

  @Field({
    description: 'Last day off, included, as an ISO date. Same as startDate for a half day.',
  })
  endDate: string;
}

/** Days a member's availability was changed by hand for a sprint, on top of working days minus time off. */
@ObjectType('SprintCapacity')
export class SprintCapacityModel {
  @Field(() => ID)
  sprintId: string;

  @Field(() => ID)
  userId: string;

  @Field(() => Float, { description: 'Halves allowed; negative takes days away.' })
  adjustmentDays: number;
}
