import supabase from './client.mjs';
import express from 'express';
const app = express();

app.use(express.json());

app.post('/auth/register', async (req, res) => {
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
    res.status(500).json({ message: 'Unexpected error' }); // Generic error message for security
  }
});

app.post('/auth/login', async (req, res) => {
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

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on port ${port}`));
