import React from 'react';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import './App.css';

export default function TextChatPage() {
  const [messages, setMessages] = React.useState([]);
  const [text, setText] = React.useState('');
  const [modalOpen, setModalOpen] = React.useState(false);
  const [botMessage, setBotMessage] = React.useState('');
  const listRef = React.useRef(null);
  const wsRef = React.useRef(null);

  React.useEffect(() => {
    // auto-scroll to bottom
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // WebSocket: connect, listen for incoming bot messages, and set up cleanup.
  React.useEffect(() => {
    // Build a WebSocket URL from the active host when REACT_APP_WS_URL is not provided.
    // Use secure wss when the page is served over https, otherwise use ws.
    const WS_URL = process.env.REACT_APP_WS_URL || (() => {
      try {
        const loc = window.location;
        const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
        // keep host (hostname:port) and use '/chat' path
        return `${protocol}//${loc.host}/ws/chat`;
      } catch (e) {
        // Fallback to localhost if anything goes wrong (e.g., window undefined)
        return 'ws://localhost:8000/ws/chat';
      }
    })();
    let ws;
    try {
      ws = new WebSocket(WS_URL);
    } catch (err) {
      console.warn('WebSocket constructor failed', err);
      return () => {};
    }
    wsRef.current = ws;

    ws.onopen = () => {
      // Optionally you could authenticate or send an initialization message here
      console.debug('WebSocket connected to', WS_URL);
    };

    ws.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        // Expect payload like: { id?, sender: 'teamtext-bot'|'<window.player_name>', text: '...' }
        if (payload && payload.text && payload.text !== '') {
          const text = payload.text || '';
          // Show incoming bot message in modal
          setBotMessage(text);
          setModalOpen(true);
        }
      } catch (e) {
        console.warn('Failed to parse WS message', e, ev.data);
      }
    };

    ws.onerror = (err) => {
      console.warn('WebSocket error', err);
    };

    ws.onclose = (ev) => {
      console.debug('WebSocket closed', ev.code, ev.reason);
      // clear ref
      if (wsRef.current === ws) wsRef.current = null;
    };

    return () => {
      try {
        if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      } catch (e) {
        /* ignore */
      }
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, []);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = window.client_hash ? `${window.client_hash}-${Date.now()}` : Date.now();
    // append locally immediately so UI is responsive
    setMessages((m) => [...m, { id, sender: window.player_name, text: trimmed }]);
    setText('');

    // transmit over websocket if available
    const payload = JSON.stringify({ id, sender: window.player_name, text: trimmed });
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(payload);
      } catch (e) {
        console.warn('Failed to send message over WebSocket', e);
      }
    } else {
      // if no websocket connection, still keep local message; optionally you could queue
      console.warn('WebSocket not connected - message sent only locally');
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
      <Box sx={{ height: '98vh', bgcolor: 'primary.background', position: 'relative' }}>

      <Box sx={{ position: 'relative', height: '95vh' }}>
        <Paper
          elevation={3}
          sx={{
            // width: full on small screens, constrained and centered on larger
            width: { xs: '100%', sm: '100%', md: '60%', lg: '50%' },
            mx: 'auto',
            // rules of thirds: place the Paper inside the middle third on large screens
            position: { xs: 'static', md: 'absolute' },
            top: { md: '33vh' },
            // On small screens fill the viewport minus the header (64px) so the page doesn't scroll.
            height: { xs: 'calc(95vh - 64px)', md: '34vh' },
            left: 0,
            right: 0,
            transform: { xs: 'none', md: 'none' },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle1">{window.game_title}</Typography>
            <Typography variant="caption" color="text.secondary">
              Playing as: <strong>{window.player_name}</strong>&nbsp;
              <sub><i>({window.client_token})</i></sub>
            </Typography>
          </Box>

          <Box
            ref={listRef}
            sx={{
              flex: 1,
              overflowY: 'auto',
              px: 2,
              py: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            {messages.map((m) => (
              <Box
                key={m.id}
                sx={{
                  display: 'flex',
                  justifyContent: m.sender === window.player_name ? 'flex-end' : 'flex-start',
                }}
              >
                <Box
                  sx={{
                    maxWidth: '80%',
                    bgcolor: m.sender === window.player_name ? 'primary.main' : 'grey.200',
                    color: m.sender === window.player_name ? 'primary.contrastText' : 'text.primary',
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    wordBreak: 'break-word',
                  }}
                >
                  <Typography variant="body2">{m.text}</Typography>
                </Box>
              </Box>
            ))}
          </Box>

          <Box component="form" onSubmit={(e) => { e.preventDefault(); send(); }} sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Message"
                variant="outlined"
                size="small"
                fullWidth
                multiline
                maxRows={4}
              />
              <IconButton color="primary" onClick={send} aria-label="send">
                <SendIcon />
              </IconButton>
            </Box>
          </Box>
        </Paper>
      </Box>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)}>
        <DialogTitle>New Message</DialogTitle>
        <DialogContent>
          <Typography style={{ userSelect: 'none' }}>{botMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setModalOpen(false);
          }}>OK</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
