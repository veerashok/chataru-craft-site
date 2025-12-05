let adminPass = "";

function setStatus(msg, good = false) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.style.color = good ? "green" : "#b3261e";
}

async function loadProducts() {
  adminPass = document.getElementById("adminPassword").value.trim();
  if (!adminPass) {
    setStatus("Enter admin password first.");
    return;
  }

  setStatus("Loading products...", false);

  try {
    const res = await fetch("/api/products");
    const products = await res.json();

    const tbody = document.getElementById("productRows");
    tbody.innerHTML = "";

    products.forEach(p => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${p.id}</td>
        <td>${p.image ? `<img src="${p.image}" alt="${p.name}">` : ""}</td>
        <td><input value="${p.name}" data-id="${p.id}" data-field="name" /></td>
        <td><input type="number" value="${p.price}" data-id="${p.id}" data-field="price" /></td>
        <td><textarea rows="3" data-id="${p.id}" data-field="description">${p.description || ""}</textarea></td>
        <td>
          <input type="file" accept="image/*" data-id="${p.id}" data-field="image">
          <div class="note">Leave empty if you don’t want to change image.</div>
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

// Add product
document.getElementById("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!adminPass) {
    setStatus("Enter admin password and click Login first.");
    return;
  }

  const form = e.target;
  const fd = new FormData(form);

  try {
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: {
        "x-admin-key": adminPass
      },
      body: fd
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed");
    }
    setStatus("Product added.", true);
    form.reset();
    loadProducts();
  } catch (err) {
    console.error(err);
    setStatus("Failed to add product.");
  }
});

// Delegate save/delete for each row
document.getElementById("productRows").addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;
  if (!id || !action) return;

  if (!adminPass) {
    setStatus("Enter admin password and click Login first.");
    return;
  }

  if (action === "delete") {
    if (!confirm("Delete this product?")) return;

    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "DELETE",
        headers: { "x-admin-key": adminPass }
      });
      if (!res.ok) throw new Error();
      setStatus("Product deleted.", true);
      loadProducts();
    } catch (err) {
      console.error(err);
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
    if (imageInput && imageInput.files && imageInput.files[0]) {
      fd.append("image", imageInput.files[0]);
    }

    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PUT",
        headers: {
          "x-admin-key": adminPass
        },
        body: fd
      });
      if (!res.ok) throw new Error();
      setStatus("Product updated.", true);
      loadProducts();
    } catch (err) {
      console.error(err);
      setStatus("Failed to update product.");
    }
  }
});
