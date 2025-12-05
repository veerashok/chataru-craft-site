// server.js
const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- DB SETUP ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
});

async function initDb() {
  // enquiries table (you already use this)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      message TEXT NOT NULL,
      source_page TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // products table for catalogue
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      description TEXT,
      image TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log("DB tables ready (enquiries, products)");
}

initDb().catch(err => {
  console.error("DB init error:", err);
});

// ---------- MIDDLEWARE ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// also explicitly serve uploads
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

// ---------- MULTER (image upload) ----------
const uploadsDir = path.join(__dirname, "public", "uploads");
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, Date.now() + ext);
  }
});
const upload = multer({ storage });

// ---------- ADMIN AUTH ----------
function adminAuth(req, res, next) {
  const adminKey = req.headers["x-admin-key"];
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: "ADMIN_PASSWORD not set on server." });
  }
  if (!adminKey || adminKey !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ---------- HEALTH ----------
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// ---------- ENQUIRY APIs (as before) ----------
app.post("/api/enquiry", async (req, res) => {
  const { name, email, phone, message, sourcePage } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ error: "Name, email and message are required." });
  }

  try {
    await pool.query(
      `INSERT INTO enquiries (name, email, phone, message, source_page)
       VALUES ($1, $2, $3, $4, $5);`,
      [name, email, phone || "", message, sourcePage || ""]
    );

    return res.json({ success: true, message: "Enquiry submitted successfully." });
  } catch (err) {
    console.error("Error saving enquiry:", err);
    return res.status(500).json({ error: "Failed to save enquiry." });
  }
});

// Admin: list enquiries
app.get("/api/admin/enquiries", adminAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, phone, message, source_page, created_at FROM enquiries ORDER BY created_at DESC;"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching enquiries:", err);
    res.status(500).json({ error: "Failed to fetch enquiries." });
  }
});

// ---------- PRODUCT CATALOGUE APIs ----------

// Public: list products for catalogue
app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, price, description, image, created_at FROM products ORDER BY created_at DESC;"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Failed to fetch products." });
  }
});

// Admin: create product (with image upload)
app.post("/api/admin/products", adminAuth, upload.single("image"), async (req, res) => {
  try {
    const { name, price, description } = req.body;
    if (!name || !price || !req.file) {
      return res.status(400).json({ error: "Name, price and image are required." });
    }

    const imgPath = "/uploads/" + req.file.filename;

    await pool.query(
      `INSERT INTO products (name, price, description, image)
       VALUES ($1, $2, $3, $4);`,
      [name, parseInt(price, 10), description || "", imgPath]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error creating product:", err);
    res.status(500).json({ error: "Failed to create product." });
  }
});

// Admin: update product (optionally new image)
app.put("/api/admin/products/:id", adminAuth, upload.single("image"), async (req, res) => {
  try {
    const { name, price, description } = req.body;
    const id = req.params.id;

    if (!name || !price) {
      return res.status(400).json({ error: "Name and price are required." });
    }

    let query = "UPDATE products SET name=$1, price=$2, description=$3";
    const params = [name, parseInt(price, 10), description || ""];

    if (req.file) {
      query += ", image=$4 WHERE id=$5";
      params.push("/uploads/" + req.file.filename, id);
    } else {
      query += " WHERE id=$4";
      params.push(id);
    }

    await pool.query(query, params);
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(500).json({ error: "Failed to update product." });
  }
});

// Admin: delete product
app.delete("/api/admin/products/:id", adminAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM products WHERE id=$1;", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: "Failed to delete product." });
  }
});

// ---------- FALLBACK ----------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Chataru Craft server running on http://localhost:${PORT}`);
});
