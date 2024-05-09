import supabase from './client.mjs';
import express from 'express';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import creds from './cred.json' assert { type: 'json' };
import options from './swagger.js';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

async function verifyUser() {
  const { data: { user } } = await supabase.auth.getSession();
  return user;
}

async function getMovies(req, res) {
  const isAuth = await verifyUser();
  if (isAuth) {
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
  } else {
    res.status(401).json({ message: 'User not authorized' });
  }
}

async function toggleWatchedMovie(res, user_uuid, movie_id) {
  const isAuth = await verifyUser();
  if (isAuth) {
    try {
      let { data: assistido, error } = await supabase
        .from('assistido')
        .select('*')
        .eq('filme_id', movie_id)
        .eq('user_id', user_uuid);

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
            { filme_id: movie_id, user_id: user_uuid },
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
}

const app = express();

app.use(express.json());

/**
 * @swagger
 * /auth/register/:
 *   post:
 *     summary: Registers a new user
 *     description: Registers a new user by providing email and password in the request body.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 description: The user's email address.
 *               password:
 *                 type: string
 *                 description: The user's password.
 *     responses:
 *       200:
 *         description: Successful user registration. 
 */
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

/**
 * @swagger
 * /auth/login/:
 *   post:
 *     summary: Authenticates user
 *     description: Authenticates a user by providing email and password in the request body.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 description: The user's email address.
 *               password:
 *                 type: string
 *                 description: The user's password.
 *     responses:
 *       200:
 *         description: Successful authentication. Response may include access token or other relevant information for further API calls.
 */
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

/**
 * @swagger
 * /auth/refresh/:
 *   post:
 *     summary: Refreshes access token
 *     description: Refreshes access token by providing a valid 'refresh_token' in the request body.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refresh_token:
 *                 type: string
 *                 description: The refresh token used to generate a new access token.  
 *     responses:
 *       200:
 *         description: Successful retrieval of a new access token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                   description: The newly generated access token.
 */
app.post('/auth/refresh/', async (req, res) => {
  const { access_token, refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ message: 'Missing refresh token' });
  }

  try {
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token
    })
    if (error) {
      console.error('Error refreshing token:', error);
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    res.json({ message: 'Access token refreshed successfully', data });
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ message: 'Unexpected error' });
  }
});


/**
 * @swagger
 * /movies/:
 *   get:
 *     summary: Get all movies
 *     description: Retrieves a list of all movies from the database.
 *     responses:
 *       200:
 *         description: Successful retrieval of movies
 */
app.get('/movies/', async (req, res) => {
  // Working (without auth still)
  await getMovies(req, res);
});

/**
 * @swagger
 * /movies/title:
 *   get:
 *     summary: Get movies that match 'title' query parameter
 *     description: Retrieves a list of movies that match the provided 'title' query parameter in the URL.
 *     parameters:
 *       - in: query
 *         name: title
 *         type: string
 *         required: true
 *         description: The movie title to search for.
 *     responses:
 *       200:
 *         description: Successful retrieval of movies matching the provided title.
 */
app.get('/movies/title/', async (req, res) => {
  const isAuth = await verifyUser();
  if (isAuth) {
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
  } else {
    res.status(401).json({ message: 'User not authorized' });
  }
});

/**
 * @swagger
 * /movies/watched/:
 *   post:
 *     summary: Mark a movie as watched by the user
 *     description: Creates a new record in the database indicating the user (identified by user_uuid) has watched the specified movie (identified by movie_id).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_uuid
 *               - movie_id 
 *             properties:
 *               user_uuid:
 *                 type: string
 *                 description: Unique identifier of the user who watched the movie
 *               movie_id:
 *                 type: integer  # Adjust type if movie ID is a different data type
 *                 description: ID of the movie marked as watched
 *     responses:
 *       200:
 *         description: Successfully marked movie as watched
 */
app.post('/movies/watched/', async (req, res) => {
  const isAuth = await verifyUser();
  if (isAuth) {
    const { user_uuid, movie_id } = req.body;

    if (!movie_id) {
      return res.status(400).json({ message: 'Missing movie ID' });
    }

    await toggleWatchedMovie(res, user_uuid, movie_id);
  } else {
    res.status(401).json({ message: 'User not authorized' });
  }
});

async function addToSheet(titulo, usuario, timestamp) {
  const jwt = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  }
  );

  const doc = new GoogleSpreadsheet(process.env.SHEETS_URL, jwt);
  await doc.loadInfo(); // loads document properties and worksheets
  const sheet = doc.sheetsByIndex[0];
  await sheet.addRow({
    titulo: titulo,
    usuario: usuario,
    timestamp: timestamp
  });
}

/**
 * @swagger
 * /movies/suggest/:
 *   post:
 *     summary: Suggest a movie to be added to the database
 *     description: Sends the suggested movie information (title and user) to a Google Sheets' sheet.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - titulo
 *               - usuario
 *             properties:
 *               titulo:
 *                 type: string
 *                 description: Title of the suggested movie
 *               usuario:
 *                 type: string
 *                 description: Username of the person suggesting the movie
 *     responses:
 *       200:
 *         description: Successful suggestion submission
 */
app.post('/movies/suggest/', async (req, res) => {
  const isAuth = await verifyUser();
  if (isAuth) {
    const { titulo, usuario } = req.body;
    const timestamp = new Date().toISOString();

    try {
      await addToSheet(titulo, usuario, timestamp);
      res.json({ message: 'Movie suggestion added successfully!' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error adding suggestion!' });
    }
  } else {
    res.status(401).json({ message: 'User not authorized' });
  }
});

const specs = swaggerJsdoc(options);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on port ${port}`));
