const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'Tryagain878787';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-in-production';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 week
}));

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------- Public routes ----------

app.get('/', (req, res) => {
  const poems = db.prepare('SELECT * FROM poems ORDER BY datetime(created_at) DESC').all();
  res.render('index', { poems, isAdmin: !!(req.session && req.session.isAdmin) });
});

app.get('/poem/:id', (req, res) => {
  const poem = db.prepare('SELECT * FROM poems WHERE id = ?').get(req.params.id);
  if (!poem) return res.status(404).send('Poem not found');
  const comments = db.prepare('SELECT * FROM comments WHERE poem_id = ? ORDER BY datetime(created_at) ASC').all(req.params.id);
  res.render('poem', { poem, comments, isAdmin: !!(req.session && req.session.isAdmin) });
});

app.post('/poem/:id/like', (req, res) => {
  db.prepare('UPDATE poems SET likes = likes + 1 WHERE id = ?').run(req.params.id);
  const ref = req.headers.referer;
  res.redirect(ref ? ref : '/poem/' + req.params.id);
});

app.post('/poem/:id/comment', (req, res) => {
  const { name, body } = req.body;
  if (!name || !name.trim() || !body || !body.trim()) {
    return res.redirect('/poem/' + req.params.id);
  }
  db.prepare('INSERT INTO comments (poem_id, name, body) VALUES (?, ?, ?)')
    .run(req.params.id, name.trim().slice(0, 60), body.trim().slice(0, 1000));
  res.redirect('/poem/' + req.params.id);
});

// ---------- Admin auth ----------

app.get('/admin/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/admin/login', (req, res) => {
  const { passcode } = req.body;
  if (passcode === ADMIN_PASSCODE) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('login', { error: 'Incorrect passcode.' });
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ---------- Admin routes ----------

app.get('/admin', requireAdmin, (req, res) => {
  const poems = db.prepare('SELECT * FROM poems ORDER BY datetime(created_at) DESC').all();
  res.render('admin', { poems });
});

app.post('/admin/poems', requireAdmin, (req, res) => {
  const { title, body } = req.body;
  if (!title || !title.trim() || !body || !body.trim()) {
    return res.redirect('/admin');
  }
  db.prepare('INSERT INTO poems (title, body) VALUES (?, ?)').run(title.trim(), body);
  res.redirect('/admin');
});

app.post('/admin/poems/:id/delete', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM comments WHERE poem_id = ?').run(req.params.id);
  db.prepare('DELETE FROM poems WHERE id = ?').run(req.params.id);
  res.redirect('/admin');
});

app.post('/admin/comments/:id/delete', requireAdmin, (req, res) => {
  const comment = db.prepare('SELECT poem_id FROM comments WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
  res.redirect(comment ? '/poem/' + comment.poem_id : '/admin');
});

app.listen(PORT, () => {
  console.log(`Poetry blog running on port ${PORT}`);
});
