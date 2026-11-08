import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdminPage from './AdminPage';

const users = [
  { user_id: 'one', player_name: 'Joe', connected: true, messages_sent: [] },
  { user_id: 'two', player_name: 'James', connected: true, messages_sent: [] },
];

afterEach(() => {
  jest.restoreAllMocks();
});

test('shows handoffs after refresh and clears the path after reset', async () => {
  let handoffs = [];
  jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
    if (url === '/api/settings/') return { ok: true, json: async () => ({}) };
    if (url === '/api/users/clear') {
      handoffs = [];
      return { ok: true };
    }
    return { ok: true, json: async () => ({ users, handoffs }) };
  });

  render(<AdminPage />);
  await screen.findByText('Joe');
  expect(screen.queryByLabelText('Message handoffs')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Got It' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

  handoffs = [{ sender_id: 'one', receiver_id: 'two' }];
  fireEvent.click(screen.getByRole('button', { name: 'Refresh participants' }));
  expect(await screen.findByLabelText('Joe sent 1 message to James')).toBeTruthy();
  expect(within(screen.getByLabelText('Message handoffs')).getByText('1', { selector: 'text' })).toBeTruthy();

  handoffs.push({ sender_id: 'one', receiver_id: 'two' }, { sender_id: 'two', receiver_id: 'one' });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh participants' }));
  expect(await screen.findByLabelText('Joe sent 2 messages to James')).toBeTruthy();
  expect(screen.getByLabelText('James sent 1 message to Joe')).toBeTruthy();
  const handoffsSvg = within(screen.getByLabelText('Message handoffs'));
  expect(handoffsSvg.getByText('2', { selector: 'text' })).toBeTruthy();
  expect(handoffsSvg.getByText('1', { selector: 'text' })).toBeTruthy();
  expect(screen.getAllByText('Joe')).toHaveLength(1);
  expect(screen.getAllByText('James')).toHaveLength(1);

  fireEvent.click(await screen.findByRole('button', { name: 'Reset' }));
  await waitFor(() => expect(screen.queryByLabelText('Message handoffs')).toBeNull());
});
