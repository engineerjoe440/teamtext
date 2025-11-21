import React from 'react';
import { Box, Paper, TextField, IconButton, Typography, CircularProgress } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import './App.css';

const MESSAGE_VISIBLE_TIME_MS = 5000;

function App() {
  const theme = createTheme({
    palette: {
      primary: {
        main: '#2d6e2dff',
      },
    },
  });
  const [messages, setMessages] = React.useState([
    { id: 1, sender: 'bot', text: 'Welcome to TeamText. Type a message below.', visible: true },
  ]);
  const [loadingValue, setLoadingValue] = React.useState(0);
  const [text, setText] = React.useState('');
  const listRef = React.useRef(null);
  const visibleTimers = React.useRef(new Map());

  React.useEffect(() => {
    // auto-scroll to bottom
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Schedule 5s deterministic loaders for any bot messages that have `visible: true`.
  // Keep track of each timer's start time so we can compute progress.
  React.useEffect(() => {
    messages.forEach((m) => {
      if (m.sender === 'bot' && m.visible && !visibleTimers.current.has(m.id)) {
        const start = Date.now();
        const tid = setTimeout(() => {
          setMessages((prev) => prev.map((msg) => (msg.id === m.id ? { ...msg, visible: false } : msg)));
          visibleTimers.current.delete(m.id);
        }, MESSAGE_VISIBLE_TIME_MS);
        visibleTimers.current.set(m.id, { tid, start });
      }
    });
  }, [messages]);

  // Clear any pending timers on unmount
  React.useEffect(() => {
    const timers = visibleTimers.current;
    return () => {
      timers.forEach(({ tid }) => clearTimeout(tid));
      timers.clear();
    };
  }, []);

  // Update loadingValue (0-100) while any bot message is loading.
  React.useEffect(() => {
    let interval = null;
    const anyLoading = messages.some((m) => m.sender === 'bot' && m.visible);
    if (anyLoading) {
      interval = setInterval(() => {
        const now = Date.now();
        const starts = Array.from(visibleTimers.current.values()).map((v) => v.start).filter(Boolean);
        if (starts.length === 0) {
          setLoadingValue(0);
          return;
        }
        const minStart = Math.min(...starts);
        const elapsed = now - minStart;
        const percent = Math.min(100, (elapsed / MESSAGE_VISIBLE_TIME_MS) * 100);
        setLoadingValue(percent);
      }, 100);
    } else {
      setLoadingValue(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [messages]);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((m) => [...m, { id: Date.now(), sender: 'me', text: trimmed }]);
    setText('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ height: '95vh', bgcolor: '#475547ff', position: 'relative' }}>
      {/* Header is positioned absolutely so content can size to full viewport without adding page scroll */}
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
        <Typography variant="h6" component="div" sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.95)' }}>TeamText</Typography>
      </Box>

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
            <Typography variant="subtitle1">TeamText</Typography>
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
                  justifyContent: m.sender === 'me' ? 'flex-end' : 'flex-start',
                }}
              >
                {((m.visible && m.sender === 'bot') || m.sender !== 'bot') && (
                  <Box
                    sx={{
                      maxWidth: '80%',
                      bgcolor: m.sender === 'me' ? 'primary.main' : 'grey.200',
                      color: m.sender === 'me' ? 'primary.contrastText' : 'text.primary',
                      px: 2,
                      py: 1,
                      borderRadius: 2,
                      wordBreak: 'break-word',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <Typography variant="body2">{m.text}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
                      <CircularProgress size={16} color="inherit" variant="determinate" value={loadingValue} />
                    </Box>
                  </Box>
                )}
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
      </Box>
    </ThemeProvider>
  );
}

export default App;
