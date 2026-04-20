const seedUsers = [
  { username: "ali", password: "1234", fullName: "Ali" },
  { username: "ayse", password: "1234", fullName: "Ayşe" },
  { username: "mehmet", password: "1234", fullName: "Mehmet" },
  { username: "zeynep", password: "1234", fullName: "Zeynep" },
  { username: "can", password: "1234", fullName: "Can" },
];

const seedProducts = [
  { id: "p1", sku: "SKU-1001", name: "Kahve Filtresi", currentLocation: "A1" },
  { id: "p2", sku: "SKU-1002", name: "Termos 500ml", currentLocation: "A2" },
  { id: "p3", sku: "SKU-1003", name: "Cam Bardak Seti", currentLocation: "B1" },
  { id: "p4", sku: "SKU-1004", name: "Masa Lambası", currentLocation: "C3" },
  { id: "p5", sku: "SKU-1005", name: "Defter A5", currentLocation: "D2" },
];

const state = {
  currentUser: null,
  selectedProductId: null,
};

function getStorage(key, fallback) {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : fallback;
}

function setStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function initData() {
  if (!localStorage.getItem("products")) {
    setStorage("products", seedProducts);
  }

  if (!localStorage.getItem("movements")) {
    setStorage("movements", []);
  }

  if (!localStorage.getItem("users")) {
    setStorage("users", seedUsers);
  }
}

function normalizeText(value) {
  return value.trim().toLocaleLowerCase("tr-TR");
}

function byId(id) {
  return document.getElementById(id);
}

function getProducts() {
  return getStorage("products", []);
}

function setProducts(products) {
  setStorage("products", products);
}

function getMovements() {
  return getStorage("movements", []);
}

function setMovements(movements) {
  setStorage("movements", movements);
}

function renderSearchResults() {
  const query = normalizeText(byId("searchInput").value || "");
  const products = getProducts();

  const filtered = !query
    ? products
    : products.filter((p) =>
        `${p.name} ${p.sku}`.toLocaleLowerCase("tr-TR").includes(query)
      );

  const container = byId("searchResults");
  if (!filtered.length) {
    container.innerHTML = `<div class="muted">Eşleşen ürün bulunamadı.</div>`;
    return;
  }

  container.innerHTML = filtered
    .map(
      (p) => `
      <article class="item">
        <strong>${p.name}</strong><br>
        <span class="muted">${p.sku} • Lokasyon: ${p.currentLocation}</span>
        <button type="button" data-product-id="${p.id}">Seç</button>
      </article>
    `
    )
    .join("");

  container.querySelectorAll("button[data-product-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedProductId = btn.dataset.productId;
      renderSelectedProduct();
    });
  });
}

function renderSelectedProduct(message = "") {
  const box = byId("selectedProductBox");
  const form = byId("updateLocationForm");

  if (!state.selectedProductId) {
    box.innerHTML = `<span class="muted">Ürün seçilmedi.</span>`;
    form.classList.add("hidden");
    return;
  }

  const product = getProducts().find((p) => p.id === state.selectedProductId);

  if (!product) {
    state.selectedProductId = null;
    box.innerHTML = `<span class="muted">Ürün bulunamadı.</span>`;
    form.classList.add("hidden");
    return;
  }

  box.innerHTML = `
    <strong>${product.name}</strong><br>
    <span class="muted">${product.sku} • Mevcut: ${product.currentLocation}</span>
    ${message ? `<p class="success">${message}</p>` : ""}
  `;

  form.classList.remove("hidden");
}

function renderHistory() {
  const movements = getMovements();
  const products = getProducts();
  const filter = normalizeText(byId("historyFilter").value || "");

  const enriched = movements
    .map((m) => {
      const product = products.find((p) => p.id === m.productId);
      return {
        ...m,
        productName: product?.name || "Silinmiş ürün",
        sku: product?.sku || "-",
      };
    })
    .filter((m) => {
      if (!filter) return true;
      return `${m.productName} ${m.sku}`
        .toLocaleLowerCase("tr-TR")
        .includes(filter);
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const container = byId("historyList");
  if (!enriched.length) {
    container.innerHTML = `<div class="muted">Henüz hareket kaydı yok.</div>`;
    return;
  }

  container.innerHTML = enriched
    .map(
      (m) => `
      <article class="item">
        <strong>${m.productName}</strong><br>
        <span class="muted">${m.sku}</span><br>
        <span>${m.fromLocation} → ${m.toLocation}</span><br>
        <span class="muted">${new Date(m.createdAt).toLocaleString("tr-TR")} • ${m.changedBy}</span>
        ${m.note ? `<br><span class="muted">Not: ${m.note}</span>` : ""}
      </article>
    `
    )
    .join("");
}

function attemptLogin(username, password) {
  const users = getStorage("users", []);
  return users.find(
    (u) => normalizeText(u.username) === normalizeText(username) && u.password === password
  );
}

function showApp() {
  byId("loginScreen").classList.add("hidden");
  byId("appScreen").classList.remove("hidden");
  byId("logoutBtn").classList.remove("hidden");

  renderSearchResults();
  renderSelectedProduct();
  renderHistory();
}

function showLogin() {
  byId("loginScreen").classList.remove("hidden");
  byId("appScreen").classList.add("hidden");
  byId("logoutBtn").classList.add("hidden");
}

function bindEvents() {
  byId("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const username = byId("username").value;
    const password = byId("password").value;

    const user = attemptLogin(username, password);
    if (!user) {
      alert("Hatalı kullanıcı veya şifre.");
      return;
    }

    state.currentUser = user;
    showApp();
  });

  byId("logoutBtn").addEventListener("click", () => {
    state.currentUser = null;
    state.selectedProductId = null;
    byId("loginForm").reset();
    showLogin();
  });

  byId("searchInput").addEventListener("input", renderSearchResults);
  byId("historyFilter").addEventListener("input", renderHistory);

  byId("updateLocationForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const newLocationRaw = byId("newLocation").value;
    const newLocation = newLocationRaw.trim().toUpperCase();

    if (!newLocation) {
      alert("Yeni lokasyon zorunlu.");
      return;
    }

    const products = getProducts();
    const idx = products.findIndex((p) => p.id === state.selectedProductId);
    if (idx < 0) {
      alert("Ürün bulunamadı.");
      return;
    }

    const oldLocation = products[idx].currentLocation;
    products[idx].currentLocation = newLocation;
    setProducts(products);

    const movements = getMovements();
    movements.push({
      id: `m_${Date.now()}`,
      productId: products[idx].id,
      fromLocation: oldLocation,
      toLocation: newLocation,
      changedBy: state.currentUser?.fullName || "Bilinmeyen",
      note: byId("movementNote").value.trim(),
      createdAt: new Date().toISOString(),
    });
    setMovements(movements);

    byId("updateLocationForm").reset();
    renderSearchResults();
    renderSelectedProduct("Lokasyon güncellendi.");
    renderHistory();
  });
}

function main() {
  initData();
  bindEvents();
  showLogin();
}

main();
