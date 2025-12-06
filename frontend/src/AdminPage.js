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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Tooltip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export default function AdminPage() {
  const [settingsApplied, setSettingsApplied] = React.useState(false);
  const [title, setTitle] = React.useState(window.game_title || 'TeamText');
  const [message, setMessage] = React.useState('');
  const [participants, setParticipants] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [expandedUserId, setExpandedUserId] = React.useState(null);

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

  // Load current settings and participants on mount
  React.useEffect(() => {
    let mounted = true;

    const loadSettingsAndParticipants = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/settings/');
        if (res.ok) {
          const settings = await res.json();
          if (mounted) {
            setTitle(settings.game_title || window.game_title || 'TeamText');
            setMessage(settings.starting_message || '');
          }
        }
      } catch (e) {
        console.warn('Failed to load settings', e);
      } finally {
        // fetch participants regardless of settings success
        if (mounted) await fetchParticipants();
        setLoading(false);
      }
    };

    loadSettingsAndParticipants();

    const id = setInterval(fetchParticipants, 10_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const startGame = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = { game_title: title, starting_message: message };
      const res = await fetch('/api/start-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.debug('Game started');
    } catch (e) {
      console.error('Failed to start game', e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async () => {
    setSettingsApplied(true);
    try {
      const payload = { game_title: title, starting_message: message };
      const res = await fetch('/api/settings/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // reflect saved title
      window.game_title = title;
      console.debug('Settings updated');
      setError(null);
    } catch (e) {
      console.error('Failed to update settings', e);
      setError(String(e));
    }
  };

  return (
    <Box sx={{ p: 4, height: '90vh', display: 'flex', justifyContent: 'center', bgcolor: 'primary.background' }}>
      <Paper sx={{ width: { xs: '100%', md: '60%' }, p: 3 }} elevation={3}>
        <Typography variant="h6" sx={{ mb: 2 }}>TeamText Control Interface</Typography>

        <TextField
          label="Game Title"
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

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={() => { setTitle(window.game_title || 'TeamText'); setMessage(''); }}>Reset</Button>
          <Button variant="outlined" onClick={updateSettings}>Update Settings</Button>
        </Box>

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
                label={u.player_name}
                color={u.connected ? 'primary' : 'default'}
                variant={u.connected ? 'filled' : 'outlined'}
                sx={{ m: 0.5, cursor: 'pointer' }}
                onClick={() => setExpandedUserId((prev) => (prev === u.user_id ? null : u.user_id))}
              />
            </Tooltip>
          ))}
        </Stack>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          { !settingsApplied ? (
            <Tooltip title="Apply settings before starting the game" arrow>
              <span>
                <Button variant="contained" onClick={startGame} disabled={!settingsApplied}>Start Game</Button>
              </span>
            </Tooltip>
          ) : (
            <Button variant="contained" onClick={startGame} disabled={!settingsApplied}>Start Game</Button>
          )}
        </Box>

        {/* Selected player's messages accordion */}
        {expandedUserId && (() => {
          const user = participants.find((p) => p.user_id === expandedUserId);
          const messages = user?.messages_sent || [];
          return (
            <Accordion expanded={Boolean(expandedUserId)} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}> 
                <Typography sx={{ fontWeight: 'bold' }}>{user?.player_name || expandedUserId}</Typography>
                <Typography sx={{ ml: 2, color: 'text.secondary' }} variant="body2">{messages.length} messages</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {messages.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No messages sent</Typography>
                ) : (
                  <List dense>
                    {messages.map((m, i) => (
                      <ListItem key={i}>
                        <ListItemText primary={typeof m === 'string' ? m : JSON.stringify(m)} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </AccordionDetails>
            </Accordion>
          );
        })()}
      </Paper>
    </Box>
  );
}
