const API_BASE = "http://localhost:8787/api";

const seedUsers = [
  { username: "ali", password: "1234", fullName: "Ali" },
  { username: "ayse", password: "1234", fullName: "Ayşe" },
  { username: "mehmet", password: "1234", fullName: "Mehmet" },
  { username: "zeynep", password: "1234", fullName: "Zeynep" },
  { username: "can", password: "1234", fullName: "Can" },
];

const state = {
  currentUser: null,
  expandedCardSku: null,
  selectionMode: false,
  selectedSkus: new Set(),
  catalog: [],
  movements: [],
  locations: [],
  apiOnline: false,
};

function byId(id) {
  return document.getElementById(id);
}

function normalizeText(value) {
  return value.trim().toLocaleLowerCase("tr-TR");
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API hata: ${res.status}`);
  return res.json();
}

async function apiPatch(path, payload) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API hata: ${res.status}`);
  return res.json();
}

async function apiPost(path, payload) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API hata: ${res.status}`);
  return res.json();
}

async function loadDataFromApi() {
  const [catalog, movements, locations] = await Promise.all([
    apiGet("/stock-cards"),
    apiGet("/movements"),
    apiGet("/locations"),
  ]);

  state.catalog = catalog;
  state.movements = movements.map((m) => ({
    id: m.id,
    sku: m.sku,
    productName: m.product_name,
    brand: m.brand,
    barcode: m.barcode,
    size: m.size,
    quantity: m.quantity,
    fromLocation: m.from_location,
    toLocation: m.to_location,
    changedBy: m.changed_by,
    note: m.note,
    createdAt: m.created_at,
  }));
  state.locations = locations;
}

function matchesQuery(card, query) {
  if (!query) return true;
  const cardText = `${card.sku} ${card.brand} ${card.productName}`.toLocaleLowerCase("tr-TR");
  const variantText = card.variants
    .map((v) => `${v.barcode} ${v.size} ${v.quantity}`)
    .join(" ")
    .toLocaleLowerCase("tr-TR");
  return `${cardText} ${variantText}`.includes(query);
}

function renderSearchResults() {
  const query = normalizeText(byId("searchInput").value || "");
  const cards = state.catalog.filter((card) => matchesQuery(card, query));
  const container = byId("searchResults");

  if (!cards.length) {
    container.innerHTML = `<div class="muted">Eşleşen ürün bulunamadı.</div>`;
    return;
  }

  container.innerHTML = cards
    .map((card) => `
      <article class="item">
        <strong>SKU: ${card.sku}</strong><br>
        <span class="muted">${card.productName}</span><br>
        <span class="muted">Lokasyon: ${card.location}</span>
      </article>
    `)
    .join("");
}

function renderHistory() {
  const filter = normalizeText(byId("historyFilter").value || "");

  const filtered = state.movements
    .filter((m) => {
      if (!filter) return true;
      return `${m.sku} ${m.productName}`
        .toLocaleLowerCase("tr-TR")
        .includes(filter);
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const container = byId("historyList");

  if (!filtered.length) {
    container.innerHTML = `<div class="muted">Henüz hareket kaydı yok.</div>`;
    return;
  }

  container.innerHTML = filtered
    .map((m) => `
      <article class="item">
        <strong>${m.productName}</strong><br>
        <span>${m.fromLocation} → ${m.toLocation}</span><br>
        <span class="muted">${new Date(m.createdAt).toLocaleString("tr-TR")}</span>
      </article>
    `)
    .join("");
}

function attemptLogin(username, password) {
  return seedUsers.find(
    (u) =>
      normalizeText(u.username) === normalizeText(username) &&
      u.password === password
  );
}

async function showApp() {
  byId("loginScreen").classList.add("hidden");
  byId("appScreen").classList.remove("hidden");

  try {
    await loadDataFromApi();
    state.apiOnline = true;
  } catch {
    state.apiOnline = false;
    alert("API çalışmıyor.");
  }

  renderSearchResults();
  renderHistory();
}

function showLogin() {
  byId("loginScreen").classList.remove("hidden");
  byId("appScreen").classList.add("hidden");
}

function bindEvents() {
  byId("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = attemptLogin(
      byId("username").value,
      byId("password").value
    );

    if (!user) {
      alert("Hatalı giriş");
      return;
    }

    state.currentUser = user;
    await showApp();
  });
}

function main() {
  bindEvents();
  showLogin();
}

main();