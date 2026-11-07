import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPanel from './AdminPanel';

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }),
  );
}

const initialMembers = [
  { id: 1, householdId: 1, email: 'admin@example.com', isAdmin: true, timezone: 'America/Chicago' },
  { id: 2, householdId: 1, email: 'member@example.com', isAdmin: false, timezone: null },
];

const noRoomsProps = {
  rooms: [],
  onRoomsChange: () => {},
  householdId: 1,
  householdName: 'The Smith House',
  householdTimezone: 'America/Chicago',
  onHouseholdTimezoneChange: () => {},
  isAdmin: false,
  memberships: [{ householdId: 1, householdName: 'The Smith House' }],
  currentHouseholdId: 1,
  currentUserId: 1,
  onSwitchHousehold: () => {},
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (url === '/api/members' && method === 'GET') {
        return jsonResponse({ success: true, data: initialMembers });
      }
      if (url === '/api/members' && method === 'POST') {
        const body = JSON.parse(init!.body as string);
        return jsonResponse({ success: true, data: { id: 3, householdId: 1, ...body } });
      }
      if (url.startsWith('/api/members/') && method === 'DELETE') {
        return jsonResponse({ success: true, data: null });
      }
      if (url === '/api/admin/join-requests' && method === 'GET') {
        return jsonResponse({ success: true, data: [] });
      }
      if (url === '/api/admin/users' && method === 'GET') {
        return jsonResponse({ success: true, data: [] });
      }
      if (url === '/api/admin/households' && method === 'GET') {
        return jsonResponse({ success: true, data: [] });
      }
      throw new Error(`Unhandled fetch: ${method} ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AdminPanel', () => {
  it('renders the fetched member list', async () => {
    render(<AdminPanel {...noRoomsProps} />);

    expect(await screen.findByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('member@example.com')).toBeInTheDocument();
  });

  it('submits the add-member form to POST /api/members and appends the result to the list', async () => {
    const user = userEvent.setup();
    render(<AdminPanel {...noRoomsProps} />);
    await screen.findByText('admin@example.com');

    await user.click(screen.getByRole('button', { name: 'Add Member' }));
    const modal = screen.getByTestId('add-member-modal-backdrop');
    await user.type(within(modal).getByLabelText('Email'), 'new@example.com');
    await user.selectOptions(within(modal).getByLabelText('Timezone'), 'America/New_York');
    await user.click(within(modal).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('new@example.com')).toBeInTheDocument();
    const fetchMock = vi.mocked(fetch);
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeDefined();
    expect(JSON.parse(postCall![1]!.body as string)).toEqual({
      email: 'new@example.com',
      timezone: 'America/New_York',
    });
  });

  it('surfaces a warning banner when POST /api/members returns one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/members' && method === 'GET') {
          return jsonResponse({ success: true, data: initialMembers });
        }
        if (url === '/api/members' && method === 'POST') {
          const body = JSON.parse(init!.body as string);
          return jsonResponse({
            success: true,
            data: { id: 3, householdId: 1, ...body },
            warning:
              'Member added, but could not be added to the Cloudflare Access allow-list automatically.',
          });
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );
    const user = userEvent.setup();
    render(<AdminPanel {...noRoomsProps} />);
    await screen.findByText('admin@example.com');

    await user.click(screen.getByRole('button', { name: 'Add Member' }));
    const modal = screen.getByTestId('add-member-modal-backdrop');
    await user.type(within(modal).getByLabelText('Email'), 'new@example.com');
    await user.click(within(modal).getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText(
        'Member added, but could not be added to the Cloudflare Access allow-list automatically.',
      ),
    ).toBeInTheDocument();
  });

  it('renders no warning banner when POST /api/members returns none', async () => {
    const user = userEvent.setup();
    render(<AdminPanel {...noRoomsProps} />);
    await screen.findByText('admin@example.com');

    await user.click(screen.getByRole('button', { name: 'Add Member' }));
    const modal = screen.getByTestId('add-member-modal-backdrop');
    // paste instead of per-keystroke typing: typing 15 chars exceeded the 5 s timeout under full-suite load
    await user.click(within(modal).getByLabelText('Email'));
    await user.paste('new@example.com');
    await user.click(within(modal).getByRole('button', { name: 'Save' }));

    await screen.findByText('new@example.com', undefined, { timeout: 4000 });
    expect(screen.queryByTestId('status-banner')).not.toBeInTheDocument();
  });

  it('flows remove-member through ConfirmDialog before calling DELETE', async () => {
    const user = userEvent.setup();
    render(<AdminPanel {...noRoomsProps} />);
    await screen.findByText('admin@example.com');

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

    // ConfirmDialog is open; DELETE must not have fired yet.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);

    await user.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true);
    });
    expect(screen.queryByText('admin@example.com')).not.toBeInTheDocument();
  });

  it('renders the Users directory at the bottom when isAdmin is true', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/members' && method === 'GET') {
          return jsonResponse({ success: true, data: initialMembers });
        }
        if (url === '/api/admin/users' && method === 'GET') {
          return jsonResponse({
            success: true,
            data: [
              {
                id: 1,
                email: 'admin@example.com',
                timezone: 'America/Chicago',
                isAdmin: true,
                households: [{ id: 1, name: 'Household A' }],
              },
            ],
          });
        }
        if (url === '/api/admin/join-requests' && method === 'GET') {
          return jsonResponse({ success: true, data: [] });
        }
        if (url === '/api/admin/households' && method === 'GET') {
          return jsonResponse({ success: true, data: [] });
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );

    render(<AdminPanel {...noRoomsProps} isAdmin={true} />);

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument();
  });

  it('hides the Delete button on the current admin own row but shows it for other users', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/members' && method === 'GET') {
          return jsonResponse({ success: true, data: initialMembers });
        }
        if (url === '/api/admin/users' && method === 'GET') {
          return jsonResponse({
            success: true,
            data: [
              {
                id: 1,
                email: 'admin@example.com',
                timezone: 'America/Chicago',
                isAdmin: true,
                households: [{ id: 1, name: 'Household A' }],
              },
              {
                id: 2,
                email: 'member@example.com',
                timezone: null,
                isAdmin: false,
                households: [{ id: 1, name: 'Household A' }],
              },
            ],
          });
        }
        if (url === '/api/admin/join-requests' && method === 'GET') {
          return jsonResponse({ success: true, data: [] });
        }
        if (url === '/api/admin/households' && method === 'GET') {
          return jsonResponse({ success: true, data: [] });
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );

    render(<AdminPanel {...noRoomsProps} isAdmin={true} currentUserId={1} />);

    const list = await screen.findByTestId('admin-user-list');
    const adminRow = within(list).getByText('admin@example.com').closest('li')!;
    const memberRow = within(list).getByText('member@example.com').closest('li')!;
    expect(within(adminRow).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(within(memberRow).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('flows delete-user through ConfirmDialog before calling DELETE /api/admin/users/:id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/members' && method === 'GET') {
          return jsonResponse({ success: true, data: initialMembers });
        }
        if (url === '/api/admin/users' && method === 'GET') {
          return jsonResponse({
            success: true,
            data: [
              {
                id: 2,
                email: 'member@example.com',
                timezone: null,
                isAdmin: false,
                households: [{ id: 1, name: 'Household A' }],
              },
            ],
          });
        }
        if (url === '/api/admin/join-requests' && method === 'GET') {
          return jsonResponse({ success: true, data: [] });
        }
        if (url === '/api/admin/users/2' && method === 'DELETE') {
          return jsonResponse({ success: true, data: null });
        }
        if (url === '/api/admin/households' && method === 'GET') {
          return jsonResponse({ success: true, data: [] });
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );

    const user = userEvent.setup();
    render(<AdminPanel {...noRoomsProps} isAdmin={true} currentUserId={1} />);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);

    await user.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true);
    });
    expect(
      within(screen.getByTestId('admin-user-list')).queryByText('member@example.com'),
    ).not.toBeInTheDocument();
  });

  it('hides Promote for users who are already admin but shows it for non-admins', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/members' && method === 'GET') {
          return jsonResponse({ success: true, data: initialMembers });
        }
        if (url === '/api/admin/users' && method === 'GET') {
          return jsonResponse({
            success: true,
            data: [
              {
                id: 1,
                email: 'admin@example.com',
                timezone: 'America/Chicago',
                isAdmin: true,
                households: [{ id: 1, name: 'Household A' }],
              },
              {
                id: 2,
                email: 'member@example.com',
                timezone: null,
                isAdmin: false,
                households: [{ id: 1, name: 'Household A' }],
              },
            ],
          });
        }
        if (url === '/api/admin/join-requests' && method === 'GET') {
          return jsonResponse({ success: true, data: [] });
        }
        if (url === '/api/admin/households' && method === 'GET') {
          return jsonResponse({ success: true, data: [] });
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );

    render(<AdminPanel {...noRoomsProps} isAdmin={true} currentUserId={1} />);

    const list = await screen.findByTestId('admin-user-list');
    const adminRow = within(list).getByText('admin@example.com').closest('li')!;
    const memberRow = within(list).getByText('member@example.com').closest('li')!;
    expect(within(adminRow).queryByRole('button', { name: 'Promote' })).not.toBeInTheDocument();
    expect(within(memberRow).getByRole('button', { name: 'Promote' })).toBeInTheDocument();
  });

  it('flows promote-user through ConfirmDialog before calling POST /api/admin/users/:id/promote', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/members' && method === 'GET') {
          return jsonResponse({ success: true, data: initialMembers });
        }
        if (url === '/api/admin/users' && method === 'GET') {
          return jsonResponse({
            success: true,
            data: [
              {
                id: 2,
                email: 'member@example.com',
                timezone: null,
                isAdmin: false,
                households: [{ id: 1, name: 'Household A' }],
              },
            ],
          });
        }
        if (url === '/api/admin/join-requests' && method === 'GET') {
          return jsonResponse({ success: true, data: [] });
        }
        if (url === '/api/admin/users/2/promote' && method === 'POST') {
          return jsonResponse({
            success: true,
            data: {
              id: 2,
              email: 'member@example.com',
              timezone: null,
              isAdmin: true,
              households: [{ id: 1, name: 'Household A' }],
            },
          });
        }
        if (url === '/api/admin/households' && method === 'GET') {
          return jsonResponse({ success: true, data: [] });
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );

    const user = userEvent.setup();
    render(<AdminPanel {...noRoomsProps} isAdmin={true} currentUserId={1} />);

    await user.click(await screen.findByRole('button', { name: 'Promote' }));
    const fetchMock = vi.mocked(fetch);
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) => input.toString() === '/api/admin/users/2/promote' && init?.method === 'POST',
      ),
    ).toBe(false);

    await user.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) => input.toString() === '/api/admin/users/2/promote' && init?.method === 'POST',
        ),
      ).toBe(true);
    });

    const list = screen.getByTestId('admin-user-list');
    const memberRow = within(list).getByText('member@example.com').closest('li')!;
    expect(within(memberRow).getByTestId('admin-badge')).toBeInTheDocument();
    expect(within(memberRow).queryByRole('button', { name: 'Promote' })).not.toBeInTheDocument();
  });

  it('does not render (or fetch) the Users directory when isAdmin is false', async () => {
    render(<AdminPanel {...noRoomsProps} isAdmin={false} />);

    await screen.findByText('admin@example.com');
    expect(screen.queryByRole('heading', { name: 'Users' })).not.toBeInTheDocument();
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls.some(([input]) => input.toString() === '/api/admin/users')).toBe(false);
  });

  it('shows the Add User button only when isAdmin is true', async () => {
    const { rerender } = render(<AdminPanel {...noRoomsProps} isAdmin={false} />);
    await screen.findByText('admin@example.com');
    expect(screen.queryByRole('button', { name: 'Add User' })).not.toBeInTheDocument();

    rerender(<AdminPanel {...noRoomsProps} isAdmin={true} />);
    expect(await screen.findByRole('button', { name: 'Add User' })).toBeInTheDocument();
  });

  it('renders the Add User button next to the Users heading, not the Members heading', async () => {
    render(<AdminPanel {...noRoomsProps} isAdmin={true} />);
    const usersHeading = await screen.findByRole('heading', { name: 'Users' });
    const addUserButton = screen.getByRole('button', { name: 'Add User' });

    expect(usersHeading.parentElement).toContainElement(addUserButton);
    const membersHeading = screen.getByRole('heading', { name: 'Members' });
    expect(membersHeading.parentElement).not.toContainElement(addUserButton);
  });

  it('submits the Add User form to POST /api/admin/members and appends to the list for the current household', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/members' && method === 'GET')
          return jsonResponse({ success: true, data: initialMembers });
        if (url === '/api/admin/join-requests' && method === 'GET')
          return jsonResponse({ success: true, data: [] });
        if (url === '/api/admin/users' && method === 'GET') return jsonResponse({ success: true, data: [] });
        if (url === '/api/admin/households' && method === 'GET') {
          return jsonResponse({
            success: true,
            data: [
              { id: 1, name: 'The Smith House' },
              { id: 2, name: 'The Jones House' },
            ],
          });
        }
        if (url === '/api/admin/members' && method === 'POST') {
          const body = JSON.parse(init!.body as string);
          return jsonResponse({ success: true, data: { id: 4, isAdmin: body.makeAdmin ?? false, ...body } });
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );
    const user = userEvent.setup();
    render(<AdminPanel {...noRoomsProps} isAdmin={true} />);
    await screen.findByText('admin@example.com');

    await user.click(screen.getByRole('button', { name: 'Add User' }));
    const modal = screen.getByTestId('add-user-modal-backdrop');
    await user.type(within(modal).getByLabelText('Household'), 'Smith');
    await user.click(await within(modal).findByRole('option', { name: 'The Smith House' }));
    await user.type(within(modal).getByLabelText('Email'), 'new-user@example.com');
    await user.click(within(modal).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('new-user@example.com')).toBeInTheDocument();
    const fetchMock = vi.mocked(fetch);
    const postCall = fetchMock.mock.calls.find(
      ([input, init]) => input.toString() === '/api/admin/members' && init?.method === 'POST',
    );
    expect(postCall).toBeDefined();
    expect(JSON.parse(postCall![1]!.body as string)).toMatchObject({
      householdId: 1,
      email: 'new-user@example.com',
    });
  });

  it('shows a confirmation naming the target household when Add User targets a different household', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/members' && method === 'GET')
          return jsonResponse({ success: true, data: initialMembers });
        if (url === '/api/admin/join-requests' && method === 'GET')
          return jsonResponse({ success: true, data: [] });
        if (url === '/api/admin/users' && method === 'GET') return jsonResponse({ success: true, data: [] });
        if (url === '/api/admin/households' && method === 'GET') {
          return jsonResponse({
            success: true,
            data: [
              { id: 1, name: 'The Smith House' },
              { id: 2, name: 'The Jones House' },
            ],
          });
        }
        if (url === '/api/admin/members' && method === 'POST') {
          const body = JSON.parse(init!.body as string);
          return jsonResponse({ success: true, data: { id: 4, isAdmin: false, ...body } });
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );
    const user = userEvent.setup();
    render(
      <AdminPanel
        {...noRoomsProps}
        isAdmin={true}
        memberships={[
          { householdId: 1, householdName: 'The Smith House' },
          { householdId: 2, householdName: 'The Jones House' },
        ]}
      />,
    );
    await screen.findByText('admin@example.com');

    await user.click(screen.getByRole('button', { name: 'Add User' }));
    const modal = screen.getByTestId('add-user-modal-backdrop');
    await user.type(within(modal).getByLabelText('Household'), 'Jones');
    await user.click(await within(modal).findByRole('option', { name: 'The Jones House' }));
    await user.type(within(modal).getByLabelText('Email'), 'other-house@example.com');
    await user.click(within(modal).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Added other-house@example.com to The Jones House.')).toBeInTheDocument();
    expect(screen.queryByText('other-house@example.com')).not.toBeInTheDocument();
  });

  it('creating a new household inline from Add User refreshes the Households directory', async () => {
    let households = [{ id: 1, name: 'The Smith House' }];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/members' && method === 'GET')
          return jsonResponse({ success: true, data: initialMembers });
        if (url === '/api/admin/join-requests' && method === 'GET')
          return jsonResponse({ success: true, data: [] });
        if (url === '/api/admin/users' && method === 'GET') return jsonResponse({ success: true, data: [] });
        if (url === '/api/admin/households' && method === 'GET') {
          return jsonResponse({ success: true, data: households });
        }
        if (url === '/api/admin/members' && method === 'POST') {
          const body = JSON.parse(init!.body as string);
          households = [...households, { id: 2, name: body.newHouseholdName }];
          return jsonResponse({
            success: true,
            data: { id: 4, householdId: 2, isAdmin: false, email: body.email, timezone: body.timezone },
          });
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );
    const user = userEvent.setup();
    render(<AdminPanel {...noRoomsProps} isAdmin={true} />);
    await screen.findByText('admin@example.com');
    expect(
      within(await screen.findByTestId('admin-household-list')).queryByText('The Lake House'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add User' }));
    const modal = screen.getByTestId('add-user-modal-backdrop');
    await user.type(within(modal).getByLabelText('Household'), 'The Lake House');
    await user.click(await within(modal).findByRole('option', { name: /Create new household/ }));
    await user.type(within(modal).getByLabelText('Email'), 'new-user@example.com');
    await user.click(within(modal).getByRole('button', { name: 'Save' }));

    expect(
      await within(screen.getByTestId('admin-household-list')).findByText('The Lake House'),
    ).toBeInTheDocument();
  });

  it('adding a user via Add User refreshes the Users directory', async () => {
    let adminUsers: {
      id: number;
      email: string;
      isAdmin: boolean;
      households: { id: number; name: string }[];
    }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/members' && method === 'GET')
          return jsonResponse({ success: true, data: initialMembers });
        if (url === '/api/admin/join-requests' && method === 'GET')
          return jsonResponse({ success: true, data: [] });
        if (url === '/api/admin/users' && method === 'GET')
          return jsonResponse({ success: true, data: adminUsers });
        if (url === '/api/admin/households' && method === 'GET') {
          return jsonResponse({
            success: true,
            data: [
              { id: 1, name: 'The Smith House' },
              { id: 2, name: 'The Jones House' },
            ],
          });
        }
        if (url === '/api/admin/members' && method === 'POST') {
          const body = JSON.parse(init!.body as string);
          adminUsers = [
            ...adminUsers,
            {
              id: 5,
              email: body.email,
              isAdmin: false,
              households: [{ id: body.householdId, name: 'The Jones House' }],
            },
          ];
          return jsonResponse({ success: true, data: { id: 5, isAdmin: false, ...body } });
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );
    const user = userEvent.setup();
    render(<AdminPanel {...noRoomsProps} isAdmin={true} />);
    await screen.findByText('admin@example.com');
    expect(
      within(await screen.findByTestId('admin-user-list')).queryByText('new-user@example.com'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add User' }));
    const modal = screen.getByTestId('add-user-modal-backdrop');
    await user.type(within(modal).getByLabelText('Household'), 'Jones');
    await user.click(await within(modal).findByRole('option', { name: 'The Jones House' }));
    await user.type(within(modal).getByLabelText('Email'), 'new-user@example.com');
    await user.click(within(modal).getByRole('button', { name: 'Save' }));

    expect(
      await within(screen.getByTestId('admin-user-list')).findByText('new-user@example.com'),
    ).toBeInTheDocument();
  });

  it('requesting a join for a brand-new email posts to /api/members/requests and shows a confirmation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/members' && method === 'GET')
          return jsonResponse({ success: true, data: initialMembers });
        if (url === '/api/members' && method === 'POST') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: false,
                error: "This person doesn't have an account yet — ask a household admin to add them.",
              }),
              { status: 403, headers: { 'content-type': 'application/json' } },
            ),
          );
        }
        if (url === '/api/members/requests' && method === 'POST') {
          const body = JSON.parse(init!.body as string);
          return jsonResponse({
            success: true,
            data: { id: 9, householdId: 1, requestedEmail: body.email, status: 'pending' },
          });
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );
    const user = userEvent.setup();
    render(<AdminPanel {...noRoomsProps} />);
    await screen.findByText('admin@example.com');

    await user.click(screen.getByRole('button', { name: 'Add Member' }));
    const modal = screen.getByTestId('add-member-modal-backdrop');
    await user.type(within(modal).getByLabelText('Email'), 'brand-new@example.com');
    await user.click(within(modal).getByRole('button', { name: 'Save' }));

    const requestButton = await within(modal).findByRole('button', {
      name: 'Ask an admin to add this person',
    });
    await user.click(requestButton);

    expect(await within(modal).findByText('Request sent — an admin will review it.')).toBeInTheDocument();
    const fetchMock = vi.mocked(fetch);
    const requestCall = fetchMock.mock.calls.find(
      ([input, init]) => input.toString() === '/api/members/requests' && init?.method === 'POST',
    );
    expect(requestCall).toBeDefined();
    expect(JSON.parse(requestCall![1]!.body as string)).toEqual({ email: 'brand-new@example.com' });
  });

  it('renders the Households directory when isAdmin is true', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/members' && method === 'GET') {
          return jsonResponse({ success: true, data: initialMembers });
        }
        if (url === '/api/admin/users' && method === 'GET') {
          return jsonResponse({ success: true, data: [] });
        }
        if (url === '/api/admin/join-requests' && method === 'GET') {
          return jsonResponse({ success: true, data: [] });
        }
        if (url === '/api/admin/households' && method === 'GET') {
          return jsonResponse({ success: true, data: [{ id: 1, name: 'The Smith House' }] });
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );

    render(<AdminPanel {...noRoomsProps} isAdmin={true} />);

    expect(await screen.findByRole('heading', { name: 'Households' })).toBeInTheDocument();
    expect(
      within(screen.getByTestId('admin-household-list')).getByText('The Smith House'),
    ).toBeInTheDocument();
  });

  it('creates a household via the Households directory and appends it to the list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/members' && method === 'GET') {
          return jsonResponse({ success: true, data: initialMembers });
        }
        if (url === '/api/admin/users' && method === 'GET') {
          return jsonResponse({ success: true, data: [] });
        }
        if (url === '/api/admin/join-requests' && method === 'GET') {
          return jsonResponse({ success: true, data: [] });
        }
        if (url === '/api/admin/households' && method === 'GET') {
          return jsonResponse({ success: true, data: [] });
        }
        if (url === '/api/admin/households' && method === 'POST') {
          const body = JSON.parse(init!.body as string);
          return jsonResponse({ success: true, data: { id: 3, ...body } });
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );

    const user = userEvent.setup();
    render(<AdminPanel {...noRoomsProps} isAdmin={true} />);

    await user.click(await screen.findByRole('button', { name: 'Create Household' }));
    const modal = screen.getByTestId('create-household-modal-backdrop');
    await user.type(within(modal).getByLabelText('Name'), 'The Jones House');
    await user.click(within(modal).getByRole('button', { name: 'Save' }));

    expect(
      await within(screen.getByTestId('admin-household-list')).findByText('The Jones House'),
    ).toBeInTheDocument();
    const fetchMock = vi.mocked(fetch);
    const postCall = fetchMock.mock.calls.find(
      ([input, init]) => input.toString() === '/api/admin/households' && init?.method === 'POST',
    );
    expect(postCall).toBeDefined();
    expect(JSON.parse(postCall![1]!.body as string)).toMatchObject({
      name: 'The Jones House',
      timezone: 'UTC',
    });
  });

  it('shows a duplicate-name error from Create Household without closing the modal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/members' && method === 'GET') {
          return jsonResponse({ success: true, data: initialMembers });
        }
        if (url === '/api/admin/users' && method === 'GET') {
          return jsonResponse({ success: true, data: [] });
        }
        if (url === '/api/admin/join-requests' && method === 'GET') {
          return jsonResponse({ success: true, data: [] });
        }
        if (url === '/api/admin/households' && method === 'GET') {
          return jsonResponse({ success: true, data: [{ id: 1, name: 'The Smith House' }] });
        }
        if (url === '/api/admin/households' && method === 'POST') {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: false, error: 'A household named "The Smith House" already exists' }),
              { status: 409, headers: { 'content-type': 'application/json' } },
            ),
          );
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );

    const user = userEvent.setup();
    render(<AdminPanel {...noRoomsProps} isAdmin={true} />);

    await user.click(await screen.findByRole('button', { name: 'Create Household' }));
    const modal = screen.getByTestId('create-household-modal-backdrop');
    await user.type(within(modal).getByLabelText('Name'), 'The Smith House');
    await user.click(within(modal).getByRole('button', { name: 'Save' }));

    expect(
      await within(modal).findByText('A household named "The Smith House" already exists'),
    ).toBeInTheDocument();
  });
});
