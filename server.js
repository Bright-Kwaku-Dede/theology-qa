const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');
const { marked } = require('marked');
const jsdom = require('jsdom');
const createDOMPurify = require('dompurify');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// SQLite database path (Render requires persistent storage)
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const dbPath = path.join(dataDir, 'qa.db');
const db = new Database(dbPath);

// Initialize DOMPurify
const window = new jsdom.JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Create tables if they don't exist
db.prepare(`
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  html TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS question_tags (
  question_id INTEGER,
  tag_id INTEGER,
  UNIQUE(question_id, tag_id)
)
`).run();

// Seed initial questions if empty
const count = db.prepare('SELECT COUNT(*) AS c FROM questions').get().c;
if (count === 0) {
  console.log('DB empty — inserting seed questions with tags...');
  const seedQuestions = [
    {
      title: "Can a person rely on the Bible for morality?",
      body: "Discussion about morality from the Bible.",
      tags: ["Morality","Bible","Theology"]
    },
    {
      title: "Do spiritual entities exist in rivers, mountains, trees, fjords, and lakes?",
      body: "Discussion about spirits in nature.",
      tags: ["Theology","Spirits","Nature"]
    },
    {
      title: "Did the God of Moses create the Universe?",
      body: "Exploring creation in the Bible.",
      tags: ["Bible","Theology","Creation"]
    },
    {
      title: "Did God demand Abraham to sacrifice his son?",
      body: "Ethics in Abraham's story.",
      tags: ["Bible","Theology","Ethics"]
    },
    {
      title: "Can the Creator of the Universe be jealous?",
      body: "God's attributes discussion.",
      tags: ["Bible","Theology","Attributes"]
    },
    {
      title: "If God gave humans free will, why are we punished for our choices?",
      body: "Free will and consequences.",
      tags: ["Theology","Ethics","Free Will"]
    },
    {
      title: "Logic behind giving land occupied by people to another group",
      body: "Discussion on biblical land promises.",
      tags: ["Bible","Theology","Ethics","History"]
    },
    {
      title: "If God spared Abraham's son, why not Jephtah's daughter?",
      body: "Ethical questions in biblical stories.",
      tags: ["Bible","Theology","Ethics"]
    },
    {
      title: "God instructs King Saul to kill the Amalekites, aren't they His creation?",
      body: "Ethics and war in the Bible.",
      tags: ["Bible","Theology","Ethics","Warfare"]
    },
    {
      title: "God appears to Abram as El, Exodus 6:3; but did not know him as Yahweh – which one is God?",
      body: "Names of God discussion.",
      tags: ["Bible","Theology","Names of God"]
    },
    {
      title: "God instructs Israelites to rape female captives – Deuteronomy 21:10",
      body: "Controversial ethical instructions in the Bible.",
      tags: ["Bible","Ethics","Controversial"]
    },
    {
      title: "Is evolution supported in the Bible?",
      body: "Bible and evolution discussion.",
      tags: ["Bible","Theology","Science","Evolution"]
    }
  ];

  seedQuestions.forEach(q=>{
    const info = db.prepare('INSERT INTO questions (title, body, html) VALUES (?,?,?)')
      .run(q.title, q.body, DOMPurify.sanitize(marked(q.body)));
    const qId = info.lastInsertRowid;
    q.tags.forEach(tagName=>{
      db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tagName);
      const tagId = db.prepare('SELECT id FROM tags WHERE name=?').get(tagName).id;
      db.prepare('INSERT OR IGNORE INTO question_tags (question_id, tag_id) VALUES (?,?)').run(qId, tagId);
    });
  });
  console.log('Seed questions and tags inserted.');
}

// API to get all questions
app.get('/api/questions', (req, res) => {
  const rows = db.prepare(`
    SELECT q.id, q.title, q.body, q.html, q.created_at,
      GROUP_CONCAT(t.name) AS tags
    FROM questions q
    LEFT JOIN question_tags qt ON q.id = qt.question_id
    LEFT JOIN tags t ON qt.tag_id = t.id
    GROUP BY q.id
    ORDER BY q.created_at DESC
  `).all();
  res.json(rows);
});

// API to get single question
app.get('/api/question/:id', (req,res)=>{
  const q = db.prepare('SELECT * FROM questions WHERE id=?').get(req.params.id);
  if (!q) return res.status(404).json({error:'Question not found'});
  const tags = db.prepare(`
    SELECT t.name FROM tags t
    JOIN question_tags qt ON t.id = qt.tag_id
    WHERE qt.question_id=?
  `).all(q.id).map(r=>r.name);
  q.tags = tags;
  res.json(q);
});

// API to post new question
app.post('/api/post', (req,res)=>{
  try{
    const {title, body, tags=[]} = req.body;
    const html = DOMPurify.sanitize(marked(body));
    const info = db.prepare('INSERT INTO questions (title, body, html) VALUES (?,?,?)').run(title, body, html);
    const qId = info.lastInsertRowid;
    tags.forEach(tagName=>{
      db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tagName);
      const tagId = db.prepare('SELECT id FROM tags WHERE name=?').get(tagName).id;
      db.prepare('INSERT OR IGNORE INTO question_tags (question_id, tag_id) VALUES (?,?)').run(qId, tagId);
    });
    res.json({success:true,id:qId});
  }catch(err){
    console.error(err);
    res.status(500).json({error:'Server error'});
  }
});

// Catch-all for SPA (Render / Node 25 compatible)
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Listening on http://localhost:${PORT}`));

