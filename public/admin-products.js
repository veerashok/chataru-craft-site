let adminLoggedIn = false;

async function adminLogin() {
  const pass = document.getElementById("adminPassword").value.trim();
  if (!pass) return setStatus("Enter password");

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pass })
    });

    if (!res.ok) return setStatus("Wrong password");
    adminLoggedIn = true;
    setStatus("Logged in", true);
    loadProducts();
  } catch (err) {
    setStatus("Login failed");
  }
}

async function adminLogout() {
  await fetch("/api/admin/logout", { method: "POST" });
  location.reload();
}

function setStatus(msg, good = false) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.style.color = good ? "green" : "#b3261e";
}

async function loadProducts() {
  if (!adminLoggedIn) return setStatus("Login first.");

  setStatus("Loading products...");
  try {
    const res = await fetch("/api/products");
    const products = await res.json();
    const tbody = document.getElementById("productRows");
    tbody.innerHTML = "";

    products.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.id}</td>
        <td>${p.image ? `<img src="${p.image}" alt="${p.name}" style="max-width: 80px;">` : ""}</td>
        <td><input value="${p.name}" data-id="${p.id}" data-field="name"></td>
        <td><input type="number" value="${p.price}" data-id="${p.id}" data-field="price"></td>
        <td><textarea rows="3" data-id="${p.id}" data-field="description">${p.description || ""}</textarea></td>
        <td>
          <input type="file" accept="image/*" data-id="${p.id}" data-field="image">
          <div class="note">Leave empty if not changing image</div>
        </td>
        <td>
          <button class="btn-small btn-save" data-action="save" data-id="${p.id}">Save</button>
          <button class="btn-small btn-del" data-action="delete" data-id="${p.id}" style="margin-left:4px;">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    setStatus(`Loaded ${products.length} product(s).`, true);
  } catch (err) {
    console.error(err);
    setStatus("Failed to load products.");
  }
}

// Add product (file upload)
document.getElementById("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!adminLoggedIn) return setStatus("Login first.");

  const form = e.target;
  const fd = new FormData(form);

  try {
    const res = await fetch("/api/admin/products", {
      method: "POST",
      body: fd
    });
    if (!res.ok) throw new Error();
    setStatus("Product added.", true);
    form.reset();
    loadProducts();
  } catch {
    setStatus("Failed to add product.");
  }
});

// Save / delete
document.getElementById("productRows").addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;
  if (!id || !action) return;
  if (!adminLoggedIn) return setStatus("Login first.");

  if (action === "delete") {
    if (!confirm("Delete this product?")) return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setStatus("Product deleted.", true);
      loadProducts();
    } catch {
      setStatus("Failed to delete product.");
    }
  }

  if (action === "save") {
    const row = btn.closest("tr");
    const name = row.querySelector('input[data-field="name"]').value;
    const price = row.querySelector('input[data-field="price"]').value;
    const description = row.querySelector('textarea[data-field="description"]').value;
    const imageInput = row.querySelector('input[data-field="image"]');

    const fd = new FormData();
    fd.append("name", name);
    fd.append("price", price);
    fd.append("description", description);
    if (imageInput.files.length > 0) fd.append("image", imageInput.files[0]);

    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PUT",
        body: fd
      });
      if (!res.ok) throw new Error();
      setStatus("Product updated.", true);
      loadProducts();
    } catch {
      setStatus("Failed to update product.");
    }
  }
});
