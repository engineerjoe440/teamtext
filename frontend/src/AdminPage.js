import React from 'react';
import {
  Box,
  CircularProgress,
  Paper,
  Typography,
  TextField,
  Button,
  Chip,
  Stack,
  Tooltip
} from '@mui/material';

export default function AdminPage() {
  const [title, setTitle] = React.useState(window.game_title || 'TeamText');
  const [message, setMessage] = React.useState('');
  const [participants, setParticipants] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchParticipants = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/users/list');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // map into a normalized form
      setParticipants(data.map((u) => ({
        user_id: u.user_id,
        player_name: u.player_name || u.user_id,
        connected: !!u.connected,
        messages_sent: u.messages_sent || [],
      })));
    } catch (e) {
      console.error('Failed to fetch participants', e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchParticipants();
    const id = setInterval(fetchParticipants, 10_000);
    return () => clearInterval(id);
  }, []);

  const save = () => {
    // Persisting is out-of-scope; for now update global and keep in state
    window.game_title = title;
    console.debug('Saved title and message', { title, message });
  };

  return (
    <Box sx={{ p: 4, height: '90vh', display: 'flex', justifyContent: 'center', bgcolor: 'primary.background' }}>
      <Paper sx={{ width: { xs: '100%', md: '60%' }, p: 3 }} elevation={3}>
        <Typography variant="h6" sx={{ mb: 2 }}>Admin</Typography>

        <TextField
          label="Application Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
        />

        <TextField
          label="Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          fullWidth
          multiline
          minRows={4}
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1">Active Players (participants)</Typography>
          {loading && <CircularProgress size={20} />}
        </Box>

        {error && (
          <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>
        )}

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 2 }}>
          {participants.map((u) => (
            <Tooltip key={u.user_id} title={u.user_id} >
              <Chip
                key={u.player_name}
                label={u.player_name}
                color={u.connected ? 'primary' : 'default'}
                variant={u.connected ? 'filled' : 'outlined'}
                sx={{ m: 0.5 }}
              />
            </Tooltip>
          ))}
        </Stack>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={() => { setTitle(window.game_title || 'TeamText'); setMessage(''); }}>Reset</Button>
          <Button variant="contained" onClick={save}>Start Game</Button>
        </Box>
      </Paper>
    </Box>
  );
}
