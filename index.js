const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 3000;

app.use(express.json());


const db = new sqlite3.Database('./users.db', (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
)`);

app.get('/', (req, res) => {
  res.send(`
    <h2>Welcome!</h2>
    <ul>
      <li><a href="/register-form">Register</a></li>
      <li><a href="/login-form">Login</a></li>
    </ul>
  `);
});


function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, 'your_jwt_secret', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}


app.get('/profile', authenticateToken, (req, res) => {
  res.json({ message: `Welcome, ${req.user.username}!`, user: req.user });
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }
 
  const hashedPassword = bcrypt.hashSync(password, 10);
 
  const query = 'INSERT INTO users (username, password) VALUES (?, ?)';
  db.run(query, [username, hashedPassword], function(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({ message: 'Username already exists.' });
      }
      return res.status(500).json({ message: 'Database error.' });
    }
    res.status(201).json({ message: 'User registered successfully.' });
  });
});



app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }
  const query = 'SELECT * FROM users WHERE username = ?';
  db.get(query, [username], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Database error.' });
    }
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
   
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
  
    const token = jwt.sign({ id: user.id, username: user.username }, 'your_jwt_secret', { expiresIn: '1h' });
    res.json({ token });
  });
});


app.get('/register-form', (req, res) => {
  res.send(`
    <h2>User Registration</h2>
    <form id="regForm">
      <input type="text" id="username" placeholder="Username" required /><br/>
      <input type="password" id="password" placeholder="Password" required /><br/>
      <button type="submit">Register</button>
    </form>
    <div id="result"></div>
    <script>
      document.getElementById('regForm').onsubmit = async function(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const res = await fetch('/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        document.getElementById('result').innerText = data.message || JSON.stringify(data);
      };
    </script>
  `);
});


app.get('/login-form', (req, res) => {
  res.send(`
    <h2>User Login</h2>
    <form id="loginForm">
      <input type="text" id="username" placeholder="Username" required /><br/>
      <input type="password" id="password" placeholder="Password" required /><br/>
      <button type="submit">Login</button>
    </form>
    <div id="loginResult"></div>
    <script>
      document.getElementById('loginForm').onsubmit = async function(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const res = await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        document.getElementById('loginResult').innerText = data.token ? 'JWT Token: ' + data.token : (data.message || JSON.stringify(data));
      };
    </script>
  `);
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

