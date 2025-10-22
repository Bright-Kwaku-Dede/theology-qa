// seed.js
const Database = require('better-sqlite3');
const db = new Database('qa.db');

// Wrap in a try/catch to catch any errors
try {
  console.log("Starting database seeding...");

  // Create table if it doesn't exist
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS qa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      tags TEXT
    )
  `;
  db.prepare(createTableSQL).run();
  console.log("Table 'qa' ensured to exist.");

  // Optional: Clear existing data (comment this out if you don't want to delete old data)
  db.prepare("DELETE FROM qa").run();
  console.log("Existing data cleared.");

  // Insert sample data
  const insertSQL = `
    INSERT INTO qa (question, answer, tags) VALUES (?, ?, ?)
  `;
  const sampleData = [
    ["What is Node.js?", "Node.js is a JavaScript runtime built on Chrome's V8 engine.", "nodejs,javascript"],
    ["What is Express?", "Express is a minimal and flexible Node.js web application framework.", "express,nodejs"],
    ["What is SQLite?", "SQLite is a lightweight, serverless SQL database engine.", "sqlite,database"]
  ];

  const stmt = db.prepare(insertSQL);
  sampleData.forEach(row => {
    stmt.run(row);
    console.log(`Inserted: ${row[0]}`);
  });

  console.log("Database seeding completed successfully!");
} catch (err) {
  console.error("Error seeding database:", err);
} finally {
  db.close();
}
