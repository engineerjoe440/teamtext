import React, { Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Box, Paper, Typography, Button, TextField } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const TextChatPage = React.lazy(() => import('./TextChatPage'));
const AdminPage = React.lazy(() => import('./AdminPage'));

export default function App() {
  const theme = createTheme({
    palette: {
      primary: {
        main: '#2d6e2dff',
        background: '#466b46ff',
      },
    },
  });

  function Home() {
    const [name, setName] = useState('');
    const to = `/play${name.trim() ? `?name=${encodeURIComponent(name.trim())}` : ''}`;

    return (
      <Box sx={{ height: '98vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'primary.background' }}>
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.paper', color: 'text.primary' }}>
          <Typography variant="h5" sx={{ mb: 2 }}>Welcome to TeamText</Typography>
          <Typography sx={{ mb: 2 }}>Let's start the conversation! Tell me your name...</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center' }}>
            <TextField placeholder="Your name" size="small" value={name} onChange={(e) => setName(e.target.value)} />
            <Button variant="contained" component={Link} to={to} disabled={!name.trim()}>Open Chat</Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/play"
            element={
              <Suspense fallback={<Box sx={{ p: 4 }}>Loading chat…</Box>}>
                <TextChatPage />
              </Suspense>
            }
          />
          <Route
            path="/admin"
            element={
              <Suspense fallback={<Box sx={{ p: 4 }}>Loading admin…</Box>}>
                <AdminPage />
              </Suspense>
            }
          />
          <Route
            path="/control"
            element={
              <Suspense fallback={<Box sx={{ p: 4 }}>Loading admin…</Box>}>
                <AdminPage />
              </Suspense>
            }
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
