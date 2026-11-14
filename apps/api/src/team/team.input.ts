import { Field, Float, ID, InputType } from '@nestjs/graphql';
import { ProjectRole, TimeOffType } from '../generated/prisma/enums';

@InputType({ description: 'Only the fields sent change. A null title clears it.' })
export class UpdateTeamMemberInput {
  @Field(() => ID)
  userId: string;

  @Field(() => ProjectRole, { nullable: true, description: 'Admins only.' })
  role?: ProjectRole;

  @Field(() => String, { nullable: true })
  title?: string | null;

  @Field(() => Boolean, { nullable: true })
  estimates?: boolean;
}

@InputType()
export class CreateHolidayInput {
  @Field({ description: 'ISO date, e.g. 2026-10-30.' })
  date: string;

  @Field()
  name: string;
}

@InputType({ description: 'Only the fields sent change.' })
export class UpdateHolidayInput {
  @Field(() => String, { nullable: true, description: 'ISO date.' })
  date?: string;

  @Field(() => String, { nullable: true })
  name?: string;
}

@InputType()
export class TimeOffInput {
  @Field(() => ID, { description: 'Who is off. Must be on the project.' })
  userId: string;

  @Field(() => TimeOffType)
  type: TimeOffType;

  @Field({ description: 'First day off, as an ISO date.' })
  startDate: string;

  @Field({ description: 'Last day off, included. A half day starts and ends on the same day.' })
  endDate: string;
}

@InputType()
export class SetSprintCapacityInput {
  @Field(() => ID)
  sprintId: string;

  @Field(() => ID)
  userId: string;

  @Field(() => Float, { description: 'Halves allowed. Zero clears the adjustment.' })
  adjustmentDays: number;
}
