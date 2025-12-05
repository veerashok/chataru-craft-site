// server.js
const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");

const adminSessions = new Map();
const app = express();
const PORT = process.env.PORT || 3000;

// ---------- MIDDLEWARE (ORDER MATTERS) ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

// ---------- DB SETUP ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
});

async function initDb() {
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

initDb().catch(err => console.error("DB init error:", err));

// ---------- IMAGE UPLOAD (MULTER) ----------
const uploadsDir = path.join(__dirname, "public", "uploads");
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, Date.now() + ext);
  }
});
const upload = multer({ storage });

// ---------- ADMIN SESSION AUTH ----------
function adminAuth(req, res, next) {
  const token = req.cookies.admin_session;
  if (!token || !adminSessions.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ---------- ADMIN LOGIN ----------
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Wrong password" });
  }

  const token = crypto.randomBytes(32).toString("hex");
  adminSessions.set(token, Date.now());

  res.cookie("admin_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7
  });

  res.json({ success: true });
});

// ---------- ADMIN LOGOUT (FIXED) ----------
app.post("/api/admin/logout", adminAuth, (req, res) => {
  const token = req.cookies.admin_session;
  if (token) adminSessions.delete(token);

  res.clearCookie("admin_session", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/"
  });

  res.json({ success: true });
});

// ---------- HEALTH CHECK ----------
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// ---------- ENQUIRY API ----------
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
    res.json({ success: true, message: "Enquiry submitted successfully." });
  } catch (err) {
    console.error("Error saving enquiry:", err);
    res.status(500).json({ error: "Failed to save enquiry." });
  }
});

// ---------- ADMIN: READ ENQUIRIES ----------
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

// Admin: add product
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

// Admin: update product
app.put("/api/admin/products/:id", adminAuth, upload.single("image"), async (req, res) => {
  try {
    const { name, price, description } = req.body;
    const id = req.params.id;
    if (!name || !price) {
      return res.status(400).json({ error: "Name and price are required." });
    }

    let query = "UPDATE products SET name=$1, price=$2, description=$3";
    let params = [name, parseInt(price, 10), description || ""];

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

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`Chataru Craft server running on http://localhost:${PORT}`);
});
