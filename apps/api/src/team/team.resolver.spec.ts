import type { UserSession } from '@thallesp/nestjs-better-auth';
import { GraphQLError } from 'graphql';
import { describe, expect, it, vi } from 'vitest';
import type { Auth } from '@/auth/auth';
import { TeamResolver } from './team.resolver';
import type { TeamService } from './team.service';

const sessionWith = (activeOrganizationId: string | null) =>
  ({ session: { activeOrganizationId }, user: { id: 'me' } }) as unknown as UserSession<Auth>;

describe('TeamResolver', () => {
  it('passes the viewer from the session to the service', async () => {
    const listMembers = vi.fn().mockResolvedValue([]);
    const resolver = new TeamResolver({ listMembers } as unknown as TeamService);

    await resolver.team(sessionWith('org1'), 'p1');

    expect(listMembers).toHaveBeenCalledWith({ organizationId: 'org1', userId: 'me' }, 'p1');
  });

  it('refuses without an active organization', () => {
    const resolver = new TeamResolver({} as TeamService);
    expect(() => resolver.team(sessionWith(null), 'p1')).toThrow(GraphQLError);
  });
});
