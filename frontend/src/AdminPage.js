import React from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { keyframes } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import dataMessages from './strings.json';


const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const drawArrow = keyframes`
  from { stroke-dashoffset: 100; }
  to { stroke-dashoffset: 0; }
`;

const randomMessage = () => {
  if (dataMessages.length === 0) return '';
  const idx = Math.floor(Math.random() * dataMessages.length);
  return dataMessages[idx];
};

function PlayerHandoffs({ participants, handoffs, onSelect }) {
  const containerRef = React.useRef(null);
  const playerRefs = React.useRef(new Map());
  const [positions, setPositions] = React.useState({});
  const markerId = React.useId();
  const connections = [];
  handoffs.forEach(({ sender_id: senderId, receiver_id: receiverId }) => {
    const connection = connections.find((item) => item.senderId === senderId && item.receiverId === receiverId);
    if (connection) connection.count += 1;
    else connections.push({ senderId, receiverId, count: 1 });
  });
  const visibleConnections = connections.filter(({ senderId, receiverId }) => (
    participants.some((player) => player.user_id === senderId) &&
    participants.some((player) => player.user_id === receiverId)
  ));
  const topPadding = visibleConnections.length ? visibleConnections.length * 34 + 12 : 0;

  React.useLayoutEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const next = {};
      playerRefs.current.forEach((element, id) => {
        const rect = element.getBoundingClientRect();
        next[id] = { x: rect.left - containerRect.left + rect.width / 2, y: rect.top - containerRect.top };
      });
      setPositions(next);
    };
    measure();
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (observer) {
      observer.observe(containerRef.current);
      playerRefs.current.forEach((element) => observer.observe(element));
    }
    return () => {
      window.removeEventListener('resize', measure);
      if (observer) observer.disconnect();
    };
  }, [participants, handoffs]);

  return (
    <Box sx={{ overflowX: 'auto', mb: 2 }}>
      <Box ref={containerRef} sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 5, width: 'max-content', minWidth: '100%', pt: `${topPadding}px`, pb: 0.5 }}>
        {visibleConnections.length > 0 && (
          <Box component="svg" role="group" aria-label="Message handoffs" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', color: 'primary.main' }}>
            <defs>
              <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            {visibleConnections.map(({ senderId, receiverId, count }, index) => {
              const start = positions[senderId];
              const end = positions[receiverId];
              if (!start || !end) return null;
              const middleX = (start.x + end.x) / 2;
              const peakY = Math.min(start.y, end.y) - 28 - index * 34;
              const controlY = 2 * peakY - (start.y + end.y) / 2;
              const sender = participants.find((player) => player.user_id === senderId);
              const receiver = participants.find((player) => player.user_id === receiverId);
              const badgeWidth = Math.max(22, String(count).length * 8 + 12);
              return (
                <g key={JSON.stringify([senderId, receiverId])} role="img" aria-label={`${sender.player_name} sent ${count} ${count === 1 ? 'message' : 'messages'} to ${receiver.player_name}`}>
                  <Box component="path" d={`M ${start.x} ${start.y} Q ${middleX} ${controlY} ${end.x} ${end.y}`} fill="none" stroke="currentColor" strokeWidth="2" markerEnd={`url(#${markerId})`} pathLength="100" sx={{ strokeDasharray: 100, animation: `${drawArrow} 700ms ease-out`, '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }} />
                  <rect x={middleX - badgeWidth / 2} y={peakY - 11} width={badgeWidth} height="22" rx="11" fill="currentColor" />
                  <text x={middleX} y={peakY} textAnchor="middle" dominantBaseline="central" fill="white" fontSize="12" fontWeight="600">{count}</text>
                </g>
              );
            })}
          </Box>
        )}
        {participants.map((player) => (
          <Box key={player.user_id} ref={(element) => {
            if (element) playerRefs.current.set(player.user_id, element);
            else playerRefs.current.delete(player.user_id);
          }}>
            <Tooltip title={player.user_id}>
              <Chip label={player.player_name} color={player.connected ? 'primary' : 'default'} variant={player.connected ? 'filled' : 'outlined'} sx={{ maxWidth: 200, cursor: 'pointer' }} onClick={() => onSelect(player.user_id)} />
            </Tooltip>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default function AdminPage() {
  const [settingsApplied, setSettingsApplied] = React.useState(false);
  const [title, setTitle] = React.useState(window.game_title || 'TeamText');
  const [message, setMessage] = React.useState(randomMessage());
  const [participants, setParticipants] = React.useState([]);
  const [handoffs, setHandoffs] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [expandedUserId, setExpandedUserId] = React.useState(null);
  const [showInstructions, setShowInstructions] = React.useState(true);
  const [finalMessage, setFinalMessage] = React.useState(null);

  const fetchParticipants = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/users/list');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // API now returns { users: [...], final_message: ... }
      setParticipants(data.users.map((u) => ({
        user_id: u.user_id,
        player_name: u.player_name || u.user_id,
        connected: !!u.connected,
        messages_sent: u.messages_sent || [],
      })));
      setFinalMessage(data.final_message || null);
      setHandoffs(data.handoffs || []);
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
            setMessage(settings.starting_message || randomMessage());
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

  const handleReset = async () => {
    setTitle(window.game_title || 'TeamText');
    setMessage(randomMessage());
    try {
      const res = await fetch('/api/users/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.debug('Players cleared');
      // Refresh participants list after clearing
      await fetchParticipants();
    } catch (e) {
      console.error('Failed to clear players', e);
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
          <Button variant="outlined" onClick={handleReset}>Reset</Button>
          <Button variant={settingsApplied ? "outlined" : "contained"} onClick={updateSettings}>Apply Settings</Button>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="subtitle1">Active Players (participants)</Typography>
          <IconButton onClick={fetchParticipants} disabled={loading} size="small" aria-label="Refresh participants">
            <RefreshIcon sx={{ animation: loading ? `${spin} 1s linear infinite` : 'none' }} />
          </IconButton>
        </Box>

        {finalMessage && (
          <Typography variant="body2" sx={{ mb: 2, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
            <strong>Final Message:</strong> {finalMessage}
          </Typography>
        )}

        {error && (
          <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>
        )}

        <PlayerHandoffs participants={participants} handoffs={handoffs} onSelect={(id) => setExpandedUserId((prev) => (prev === id ? null : id))} />

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

      <Dialog open={showInstructions} onClose={() => setShowInstructions(false)}>
        <DialogTitle>Setup Instructions</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Before you can start playing the game with participants, please follow these steps:
          </Typography>
          <Box sx={{ pl: 2 }}>
            <Typography variant="body2">1. Set the <strong>Game Title</strong></Typography>
            <Typography variant="body2">2. Set an appropriate <strong>Message</strong></Typography>
            <Typography variant="body2">3. Click the <strong>"Apply Settings"</strong> button to save your settings</Typography>
            <Typography variant="body2">4. Then you can click <strong>"Start Game"</strong> to begin playing with participants</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInstructions(false)} variant="contained">Got It</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
