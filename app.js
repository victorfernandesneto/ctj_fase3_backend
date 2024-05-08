import supabase from './client.mjs';
import express from 'express';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import creds from './cred.json' assert { type: 'json' };

async function getMovies(req, res) {
  try {
    let { data: filmes, error } = await supabase
      .from('filmes')
      .select('*');

    if (error) {
      console.error('Error fetching movies:', error);
      return res.status(500).json({ message: 'Failed to retrieve movies' });
    }

    res.json(filmes);
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function toggleWatchedMovie(req, res, movieId) {
  const userUuid = req.user.uuid;

  try {
    let { data: assistido, error } = await supabase
      .from('assistido')
      .select('*')
      .eq('filme_id', movieId)
      .eq('user_id', userUuid);

    if (error) {
      console.error('Error checking watched movies:', error);
      return res.status(500).json({ message: 'Failed to check watched status' });
    }

    if (assistido.length > 0) {
      const { error } = await supabase
        .from('assistido')
        .delete()
        .eq('id', assistido[0].id);

      if (error) {
        console.error('Error removing watched movie:', error);
        return res.status(500).json({ message: 'Failed to remove movie from watched list' });
      }

      return res.json({ message: 'Movie removed from watched list successfully' });
    } else {
      const { data, error } = await supabase
        .from('assistido')
        .insert([
          { filme_id: movieId, user_id: userUuid },
        ])
        .select();

      if (error) {
        console.error('Error marking movie as watched:', error);
        return res.status(500).json({ message: 'Failed to mark movie as watched' });
      }

      return res.json({ message: 'Movie marked as watched successfully' });
    }
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

const app = express();

app.use(express.json());

app.post('/auth/register/', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Missing email or password' });
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error('Signup error:', error);
      return res.status(500).json({ message: 'Signup failed' });
    }

    res.json({ message: 'Signup successful' });
  } catch (err) {
    console.error('Unexpected signup error:', err);
    res.status(500).json({ message: 'Unexpected error' });
  }
});

app.post('/auth/login/', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Missing email or password' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Login error:', error);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({ message: 'Login successful', data });
  } catch (err) {
    console.error('Unexpected login error:', err);
    res.status(500).json({ message: 'Unexpected error' });
  }
});

app.post('/auth/refresh/', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Missing refresh token' });
  }

  try {
    const { data, error } = await supabase.auth.refreshSession(refreshToken);
    if (error) {
      console.error('Error refreshing token:', error);
      // Error refreshing token: AuthSessionMissingError: Auth session missing!
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    res.json({ message: 'Access token refreshed successfully', data: { access_token: data.access_token } });
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ message: 'Unexpected error' });
  }
});

app.get('/movies/', async (req, res) => {
  // Working (without auth still)
  await getMovies(req, res);
});

app.get('/movies/title/', async (req, res) => {
  // Working (without auth still)
  const { title } = req.query;

  if (!title) {
    return res.status(400).json({ message: 'Missing title parameter' });
  }

  try {
    let { data: filmes, error } = await supabase
      .from('filmes')
      .select('*')
      .ilike('titulo', `%${title}%`);

    if (error) {
      console.error('Error fetching movies:', error);
      return res.status(500).json({ message: 'Failed to retrieve movies' });
    }

    res.json(filmes);
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/movies/watched', async (req, res) => {
  // Not working (needs auth to work)
  const { movieId } = req.body;

  if (!movieId) {
    return res.status(400).json({ message: 'Missing movie ID' });
  }

  await toggleWatchedMovie(req, res, movieId);
});

async function addToSheet(titulo, usuario, timestamp) {
  const jwt = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  });
  
  const doc = new GoogleSpreadsheet(process.env.SHEETS_URL, jwt);
  await doc.loadInfo(); // loads document properties and worksheets
  const sheet = doc.sheetsByIndex[0];
  await sheet.addRow({ titulo: titulo,
    usuario: usuario,
  timestamp: timestamp});
}

app.post('/movies/suggest', async (req, res) => {
  const { titulo, usuario } = req.body;
  const timestamp = new Date().toISOString();

  try {
    await addToSheet(titulo, usuario, timestamp);
    res.json({ message: 'Movie suggestion added successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error adding suggestion!' });
  }
});


const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on port ${port}`));
