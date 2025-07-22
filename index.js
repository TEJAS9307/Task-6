const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(__dirname));


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

db.run(`ALTER TABLE users ADD COLUMN email TEXT`, () => {});
db.run(`ALTER TABLE users ADD COLUMN bio TEXT`, () => {});
db.run(`ALTER TABLE users ADD COLUMN profile_picture TEXT`, () => {});
db.run(`ALTER TABLE users ADD COLUMN mob_no TEXT`, () => {});

db.run(`CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);

db.run(`CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER,
  user_id INTEGER,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(post_id) REFERENCES posts(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);

db.run(`CREATE TABLE IF NOT EXISTS likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER,
  user_id INTEGER,
  UNIQUE(post_id, user_id),
  FOREIGN KEY(post_id) REFERENCES posts(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);

db.run(`ALTER TABLE posts ADD COLUMN photo_url TEXT`, () => {});

db.run(`CREATE TABLE IF NOT EXISTS follows (
  follower_id INTEGER,
  following_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  FOREIGN KEY(follower_id) REFERENCES users(id),
  FOREIGN KEY(following_id) REFERENCES users(id)
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
  const userId = req.user.id;
  db.get('SELECT id, username, email, bio, mob_no, profile_picture FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ message: 'Database error.' });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(user);
  });
});

app.put('/profile', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { email, bio, mob_no, profile_picture } = req.body;
  if (email) {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }
    if (email.length > 100) {
      return res.status(400).json({ message: 'Email too long (max 100 chars).' });
    }
  }
  if (bio && bio.length > 200) {
    return res.status(400).json({ message: 'Bio too long (max 200 chars).' });
  }
  if (mob_no) {
    if (!/^\d{10,15}$/.test(mob_no)) {
      return res.status(400).json({ message: 'Mobile number must be 10-15 digits.' });
    }
  }
  if (profile_picture) {
    if (!/^https?:\/\//.test(profile_picture)) {
      return res.status(400).json({ message: 'Profile picture must be a valid URL (http or https).' });
    }
  }
  db.run('UPDATE users SET email = COALESCE(?, email), bio = COALESCE(?, bio), mob_no = COALESCE(?, mob_no), profile_picture = COALESCE(?, profile_picture) WHERE id = ?', [email, bio, mob_no, profile_picture, userId], function(err) {
    if (err) return res.status(500).json({ message: 'Database error.' });
    if (this.changes === 0) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: 'Profile updated successfully.' });
  });
});

app.post('/register', (req, res) => {
  const { username, password, email, bio, profile_picture, mob_no } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }
  const hashedPassword = bcrypt.hashSync(password, 10);
  const query = 'INSERT INTO users (username, password, email, bio, profile_picture, mob_no) VALUES (?, ?, ?, ?, ?, ?)';
  db.run(query, [username, hashedPassword, email || null, bio || null, profile_picture || null, mob_no || null], function(err) {
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
      <input type="text" id="username" name="username" autocomplete="username" placeholder="Username" required /><br/>
      <input type="password" id="password" name="password" autocomplete="current-password" placeholder="Password" required /><br/>
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
      <input type="text" id="username" name="username" autocomplete="username" placeholder="Username" required /><br/>
      <input type="password" id="password" name="password" autocomplete="current-password" placeholder="Password" required /><br/>
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


app.get('/profile-form', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>User Profile</title>
</head>
<body>
  <h2>User Profile</h2>
    <div>
      <label>JWT Token: <input type="text" id="token" size="60" /></label>
      <button onclick="loadProfile()">Load My Profile</button>
    </div>
    <div style="margin-top:20px;">
      <label>View User: <input type="text" id="searchUsername" placeholder="Enter username" /> </label>
      <button onclick="loadOtherProfile()">View</button>
    </div>
    <form id="profileForm" style="display:none;">
      <div>Username: <span id="username"></span></div>
      <div>Email: <input type="email" id="email" name="email" autocomplete="email" /></div>
      <div>Bio: <input type="text" id="bio" /></div>
      <div>Mobile No: <input type="text" id="mob_no" /></div>
      <div>Profile Picture URL: <input type="text" id="profile_picture" /></div>
      <div id="profilePicPreview"></div>
      <button type="submit">Update Profile</button>
    </form>
    <div id="profileResult"></div>
    <div id="otherProfile" style="margin-top:30px;"></div>
    <script>
      async function safeParse(res) {
        var contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return await res.json();
        } else {
          return await res.text();
        }
      }
      async function loadProfile() {
        var token = document.getElementById('token').value;
        var res = await fetch('/profile', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        var data = await safeParse(res);
        if (!res.ok) {
          document.getElementById('profileForm').style.display = 'none';
          document.getElementById('profileResult').innerText = (data.message || data);
          return;
        }
        document.getElementById('profileForm').style.display = '';
        document.getElementById('username').innerText = data.username;
        document.getElementById('email').value = data.email || '';
        document.getElementById('bio').value = data.bio || '';
        document.getElementById('mob_no').value = data.mob_no || '';
        document.getElementById('profile_picture').value = data.profile_picture || '';
        document.getElementById('profilePicPreview').innerHTML = data.profile_picture ? '<img src="' + data.profile_picture + '" alt="Profile Picture" width="100" />' : '';
        document.getElementById('profileResult').innerText = '';
      }
      document.getElementById('profileForm').onsubmit = async function(e) {
        e.preventDefault();
        var token = document.getElementById('token').value;
        var email = document.getElementById('email').value;
        var bio = document.getElementById('bio').value;
        var mob_no = document.getElementById('mob_no').value;
        var profile_picture = document.getElementById('profile_picture').value;
        var res = await fetch('/profile', {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email: email, bio: bio, mob_no: mob_no, profile_picture: profile_picture })
        });
        var data = await safeParse(res);
        document.getElementById('profileResult').innerText = (data.message || data);
        if (res.ok) loadProfile();
      };

      async function loadOtherProfile() {
        var username = document.getElementById('searchUsername').value;
        var token = document.getElementById('token').value;
        if (!username) return;
        var res = await fetch('/users/' + encodeURIComponent(username));
        var data = await safeParse(res);
        if (!res.ok) {
          document.getElementById('otherProfile').innerHTML = (data.message || data);
          return;
        }
        // Get follower/following counts (already included in /users/:username)
        var html = '<div><b>@' + data.username + '</b></div>';
        html += data.profile_picture ? '<div><img src="' + data.profile_picture + '" width="80" /></div>' : '';
        html += '<div>Bio: ' + (data.bio || '') + '</div>';
        html += '<div>Mobile: ' + (data.mob_no || '') + '</div>';
        html += '<div>Followers: <span id="followerCount">' + (data.follower_count || 0) + '</span> | Following: <span id="followingCount">' + (data.following_count || 0) + '</span></div>';
        // If logged in and not viewing own profile, show follow/unfollow button
        var myUsername = '';
        if (token) {
          try {
            var payload = JSON.parse(atob(token.split('.')[1]));
            myUsername = payload.username;
          } catch (e) {}
        }
        if (token && myUsername && myUsername !== data.username) {
          fetch('/users/' + encodeURIComponent(username) + '/followers').then(function(r) {
            return safeParse(r);
          }).then(function(followers) {
            var isFollowing = false;
            for (var i = 0; i < followers.length; i++) {
              if (followers[i].username === myUsername) {
                isFollowing = true;
                break;
              }
            }
            html += '<button id="followBtn">' + (isFollowing ? 'Unfollow' : 'Follow') + '</button>';
            document.getElementById('otherProfile').innerHTML = html;
            document.getElementById('followBtn').onclick = function() {
              var method = isFollowing ? 'DELETE' : 'POST';
              fetch('/users/' + encodeURIComponent(username) + '/follow', {
                method: method,
                headers: { 'Authorization': 'Bearer ' + token }
              })
              .then(function(res2) { return safeParse(res2); })
              .then(function(result) {
                alert(result.message || result);
                loadOtherProfile();
              });
            };
          });
        } else {
          document.getElementById('otherProfile').innerHTML = html;
        }
      }
    </script>
  `);
});


app.get('/users/:username', (req, res) => {
  const { username } = req.params;
  
  if (!/^\w{3,30}$/.test(username)) {
    return res.status(400).json({ message: 'Invalid username format.' });
  }
  db.get('SELECT id, username, bio, profile_picture, mob_no FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ message: 'Database error.' });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    db.get('SELECT COUNT(*) as follower_count FROM follows WHERE following_id = ?', [user.id], (err, followerRow) => {
      if (err) return res.status(500).json({ message: 'Database error.' });
      db.get('SELECT COUNT(*) as following_count FROM follows WHERE follower_id = ?', [user.id], (err, followingRow) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        res.json({
          ...user,
          follower_count: followerRow.follower_count || 0,
          following_count: followingRow.following_count || 0
        });
      });
    });
  });
});


app.post('/posts', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { title, content, photo_url } = req.body;
  if (!title || !content) {
    return res.status(400).json({ message: 'Title and content are required.' });
  }
  const query = 'INSERT INTO posts (user_id, title, content, photo_url) VALUES (?, ?, ?, ?)';
  db.run(query, [userId, title, content, photo_url || null], function(err) {
    if (err) return res.status(500).json({ message: 'Database error.' });
    res.status(201).json({ id: this.lastID, user_id: userId, title, content, photo_url });
  });
});


app.post('/posts/:id/comments', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const postId = req.params.id;
  const { content } = req.body;
  if (!content || content.length < 1) {
    return res.status(400).json({ message: 'Content is required.' });
  }
  db.get('SELECT * FROM posts WHERE id = ?', [postId], (err, post) => {
    if (err) return res.status(500).json({ message: 'Database error.' });
    if (!post) return res.status(404).json({ message: 'Post not found.' });
    db.run('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)', [postId, userId, content], function(err) {
      if (err) return res.status(500).json({ message: 'Database error.' });
      res.status(201).json({ id: this.lastID, post_id: postId, user_id: userId, content });
    });
  });
});


app.get('/posts/:id/comments', (req, res) => {
  const postId = req.params.id;
  db.all('SELECT comments.*, users.username FROM comments JOIN users ON comments.user_id = users.id WHERE post_id = ? ORDER BY created_at ASC', [postId], (err, comments) => {
    if (err) return res.status(500).json({ message: 'Database error.' });
    res.json(comments);
  });
});


app.post('/posts/:id/like', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const postId = req.params.id;
  db.get('SELECT * FROM posts WHERE id = ?', [postId], (err, post) => {
    if (err) return res.status(500).json({ message: 'Database error.' });
    if (!post) return res.status(404).json({ message: 'Post not found.' });
    db.run('INSERT OR IGNORE INTO likes (post_id, user_id) VALUES (?, ?)', [postId, userId], function(err) {
      if (err) return res.status(500).json({ message: 'Database error.' });
      if (this.changes === 0) return res.status(409).json({ message: 'Already liked.' });
      res.json({ message: 'Post liked.' });
    });
  });
});


app.delete('/posts/:id/like', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const postId = req.params.id;
  db.run('DELETE FROM likes WHERE post_id = ? AND user_id = ?', [postId, userId], function(err) {
    if (err) return res.status(500).json({ message: 'Database error.' });
    if (this.changes === 0) return res.status(404).json({ message: 'Like not found.' });
    res.json({ message: 'Post unliked.' });
  });
});


app.get('/posts', (req, res) => {
  db.all('SELECT posts.*, users.username FROM posts JOIN users ON posts.user_id = users.id ORDER BY created_at DESC', [], async (err, posts) => {
    if (err) return res.status(500).json({ message: 'Database error.' });
    
    const postIds = posts.map(p => p.id);
    if (postIds.length === 0) return res.json([]);
    db.all('SELECT post_id, COUNT(*) as like_count FROM likes WHERE post_id IN (' + postIds.map(() => '?').join(',') + ') GROUP BY post_id', postIds, (err, likeRows) => {
      if (err) return res.status(500).json({ message: 'Database error.' });
      const likeMap = {};
      likeRows.forEach(row => { likeMap[row.post_id] = row.like_count; });
      db.all('SELECT post_id, COUNT(*) as comment_count FROM comments WHERE post_id IN (' + postIds.map(() => '?').join(',') + ') GROUP BY post_id', postIds, (err, commentRows) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        const commentMap = {};
        commentRows.forEach(row => { commentMap[row.post_id] = row.comment_count; });
        const postsWithCounts = posts.map(post => ({
          ...post,
          like_count: likeMap[post.id] || 0,
          comment_count: commentMap[post.id] || 0
        }));
        res.json(postsWithCounts);
      });
    });
  });
});


app.get('/posts/:id', (req, res) => {
  const postId = req.params.id;
  db.get('SELECT posts.*, users.username FROM posts JOIN users ON posts.user_id = users.id WHERE posts.id = ?', [postId], (err, post) => {
    if (err) return res.status(500).json({ message: 'Database error.' });
    if (!post) return res.status(404).json({ message: 'Post not found.' });
    db.get('SELECT COUNT(*) as like_count FROM likes WHERE post_id = ?', [postId], (err, likeRow) => {
      if (err) return res.status(500).json({ message: 'Database error.' });
      db.get('SELECT COUNT(*) as comment_count FROM comments WHERE post_id = ?', [postId], (err, commentRow) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        res.json({
          ...post,
          like_count: likeRow.like_count || 0,
          comment_count: commentRow.comment_count || 0
        });
      });
    });
  });
});


app.get('/posts/:id/likes', (req, res) => {
  const postId = req.params.id;
  const wantUser = req.query.user;
  db.get('SELECT COUNT(*) as like_count FROM likes WHERE post_id = ?', [postId], (err, row) => {
    if (err) return res.status(500).json({ message: 'Database error.' });
    if (wantUser && req.headers['authorization']) {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) return res.json({ like_count: row.like_count, liked: false });
      jwt.verify(token, 'your_jwt_secret', (err, user) => {
        if (err) return res.json({ like_count: row.like_count, liked: false });
        db.get('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?', [postId, user.id], (err, likeRow) => {
          if (err) return res.status(500).json({ message: 'Database error.' });
          res.json({ like_count: row.like_count, liked: !!likeRow });
        });
      });
    } else {
      res.json({ like_count: row.like_count });
    }
  });
});


app.put('/posts/:id', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const postId = req.params.id;
  const { title, content } = req.body;
  if (!title && !content) {
    return res.status(400).json({ message: 'Title or content required.' });
  }
  db.get('SELECT * FROM posts WHERE id = ?', [postId], (err, post) => {
    if (err) return res.status(500).json({ message: 'Database error.' });
    if (!post) return res.status(404).json({ message: 'Post not found.' });
    if (post.user_id !== userId) return res.status(403).json({ message: 'Not authorized.' });
    const newTitle = title || post.title;
    const newContent = content || post.content;
    db.run('UPDATE posts SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newTitle, newContent, postId], function(err) {
      if (err) return res.status(500).json({ message: 'Database error.' });
      res.json({ message: 'Post updated.' });
    });
  });
});


app.delete('/posts/:id', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const postId = req.params.id;
  db.get('SELECT * FROM posts WHERE id = ?', [postId], (err, post) => {
    if (err) return res.status(500).json({ message: 'Database error.' });
    if (!post) return res.status(404).json({ message: 'Post not found.' });
    if (post.user_id !== userId) return res.status(403).json({ message: 'Not authorized.' });
    db.run('DELETE FROM posts WHERE id = ?', [postId], function(err) {
      if (err) return res.status(500).json({ message: 'Database error.' });
      res.json({ message: 'Post deleted.' });
    });
  });
});

app.get('/posts-form', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Posts</title>
</head>
<body>
  <h2>Posts</h2>
    <div>
      <label>JWT Token: <input type="text" id="token" size="60" /></label>
    </div>
    <h3>Create Post</h3>
    <form id="createPostForm">
      <input type="text" id="title" name="title" autocomplete="off" placeholder="Title" required /> <br/>
      <textarea id="content" name="content" autocomplete="off" placeholder="Content" required></textarea> <br/>
      <input type="text" id="photo_url" name="photo_url" autocomplete="off" placeholder="Photo URL (optional)" /> <br/>
      <button type="submit">Create Post</button>
    </form>
    <div id="createResult"></div>
    <h3>All Posts</h3>
    <button onclick="loadPosts()">Show All Posts</button>
    <button onclick="loadMyPosts()">Show My Posts</button>
    <div id="postsList"></div>
    <div id="commentsModal" style="display:none; position:fixed; top:10%; left:50%; transform:translateX(-50%); background:#fff; border:1px solid #ccc; padding:20px; z-index:1000; max-width:500px; max-height:80vh; overflow:auto;">
      <button onclick="closeCommentsModal()" style="float:right;">&times;</button>
      <h4>Comments</h4>
      <div id="commentsList"></div>
      <form id="addCommentForm" style="margin-top:10px;">
        <input type="text" id="commentContent" name="commentContent" autocomplete="off" placeholder="Add a comment..." required style="width:80%;" />
        <button type="submit">Post</button>
      </form>
      <div id="commentResult"></div>
    </div>
    <div id="modalBackdrop" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.3); z-index:999;"></div>
    <script src="/posts-form.js"></script>
</body>
</html>
  `);
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});



app.post('/users/:username/follow', authenticateToken, (req, res) => {
  const followerId = req.user.id;
  const { username } = req.params;
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ message: 'Database error.' });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.id === followerId) return res.status(400).json({ message: 'Cannot follow yourself.' });
    db.run('INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)', [followerId, user.id], function(err) {
      if (err) return res.status(500).json({ message: 'Database error.' });
      if (this.changes === 0) return res.status(409).json({ message: 'Already following.' });
      res.json({ message: 'Now following user.' });
    });
  });
});


app.delete('/users/:username/follow', authenticateToken, (req, res) => {
  const followerId = req.user.id;
  const { username } = req.params;
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ message: 'Database error.' });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.id === followerId) return res.status(400).json({ message: 'Cannot unfollow yourself.' });
    db.run('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [followerId, user.id], function(err) {
      if (err) return res.status(500).json({ message: 'Database error.' });
      if (this.changes === 0) return res.status(404).json({ message: 'Not following.' });
      res.json({ message: 'Unfollowed user.' });
    });
  });
});


app.get('/users/:username/followers', (req, res) => {
  const { username } = req.params;
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ message: 'Database error.' });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    db.all('SELECT users.id, users.username, users.profile_picture FROM follows JOIN users ON follows.follower_id = users.id WHERE follows.following_id = ?', [user.id], (err, rows) => {
      if (err) return res.status(500).json({ message: 'Database error.' });
      res.json(rows);
    });
  });
});


app.get('/users/:username/following', (req, res) => {
  const { username } = req.params;
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ message: 'Database error.' });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    db.all('SELECT users.id, users.username, users.profile_picture FROM follows JOIN users ON follows.following_id = users.id WHERE follows.follower_id = ?', [user.id], (err, rows) => {
      if (err) return res.status(500).json({ message: 'Database error.' });
      res.json(rows);
    });
  });
});

