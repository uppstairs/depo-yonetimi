const isLocalHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const hostParts = window.location.hostname.split(".");
const rootDomain = hostParts.length >= 2 ? hostParts.slice(-2).join(".") : window.location.hostname;

const API_BASE_CANDIDATES = isLocalHost
  ? ["http://localhost:8787/api"]
  : ["/api", `${window.location.protocol}//api.${rootDomain}/api`, `${window.location.protocol}//${window.location.hostname}:8787/api`];

let resolvedApiBase = null;

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
  const res = await apiRequest(path, { method: "GET" });
  if (!res.ok) throw new Error(`API hata: ${res.status}`);
  return res.json();
}

async function apiPatch(path, payload) {
  const res = await apiRequest(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API hata: ${res.status}`);
  return res.json();
}

async function apiPost(path, payload) {
  const res = await apiRequest(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API hata: ${res.status}`);
  return res.json();
}

async function apiRequest(path, options) {
  const bases = resolvedApiBase ? [resolvedApiBase] : API_BASE_CANDIDATES;

  for (const base of bases) {
    try {
      const res = await fetch(`${base}${path}`, options);

      // 404 çoğunlukla yanlış route/base anlamına geldiği için bir sonraki adrese geç.
      if (res.status === 404 && !resolvedApiBase) continue;

      resolvedApiBase = base;
      return res;
    } catch (_error) {
      // Network/CORS hatası: sonraki adayı dene.
    }
  }

  throw new Error("Hiçbir API adresine bağlanılamadı.");
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

function populateLocationSelects() {
  const options = state.locations.map((loc) => `<option value="${loc}">${loc}</option>`).join("");
  const bulkLocation = byId("bulkLocation");
  const newCardLocation = byId("newCardLocation");
  if (bulkLocation) bulkLocation.innerHTML = options;
  if (newCardLocation) newCardLocation.innerHTML = options;
}

function populateSkuSelect() {
  const options = state.catalog.map((card) => `<option value="${card.sku}">${card.sku} - ${card.productName}</option>`);
  const variantSku = byId("variantSku");
  if (variantSku) variantSku.innerHTML = options.join("");
}

function downloadImportTemplate() {
  const template = [
    "sku,brand,productName,barcode,size,quantity,location",
    "1001,Jack Jones,Beyaz Tişört,123456,XS,6,A1",
    "1001,Jack Jones,Beyaz Tişört,234561,S,8,A1",
    "3003,OnlyBrand,Temel Ürün,,,,B2",
  ].join("\\n");

  const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "stok_karti_sablon.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseCsvRows(csvText) {
  const lines = csvText.split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
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
    .map((card) => {
      const checked = state.selectedSkus.has(card.sku) ? "checked" : "";
      const editorOpen = state.expandedCardSku === card.sku;
      const locationOptions = state.locations
        .map((loc) => `<option value="${loc}" ${loc === card.location ? "selected" : ""}>${loc}</option>`)
        .join("");

      const variantsHtml = card.variants
        .map((variant) => {
          return `
            <div class="variant-row">
              <div>
                <span><strong>Barkod:</strong> ${variant.barcode}</span><br>
                <span class="muted"><strong>Beden:</strong> ${variant.size} • <strong>Adet:</strong> ${variant.quantity}</span>
              </div>
            </div>
          `;
        })
        .join("");

      return `
        <article class="item" data-open-editor="${card.sku}">
          <strong>SKU: ${card.sku}</strong><br>
          <span class="muted">Marka: ${card.brand}</span><br>
          <span class="muted">Ürün Adı: ${card.productName}</span><br>
          <span class="muted"><strong>Lokasyon:</strong> ${card.location}</span>
          ${state.selectionMode ? `<input type="checkbox" data-sku-checkbox="${card.sku}" ${checked} />` : ""}
          ${
            editorOpen
              ? `<form class="stack inline-editor" data-card-form="${card.sku}">
                  <label>
                    Yeni Lokasyon
                    <select data-card-location="${card.sku}" required>${locationOptions}</select>
                  </label>
                  <label>
                    Not
                    <input data-card-note="${card.sku}" placeholder="Opsiyonel" />
                  </label>
                  <button type="submit">Stok Kartı Lokasyonunu Güncelle</button>
                </form>`
              : ""
          }
          <div class="variant-list">${variantsHtml}</div>
        </article>
      `;
    })
    .join("");

  bindCardEvents();
}

async function updateStockCardLocation(sku) {
  const locationInput = document.querySelector(`[data-card-location="${sku}"]`);
  const noteInput = document.querySelector(`[data-card-note="${sku}"]`);
  const newLocation = locationInput?.value;
  const note = noteInput?.value?.trim() || "";

  if (!newLocation) {
    alert("Yeni lokasyon seçmelisiniz.");
    return;
  }

  try {
    await apiPatch(`/stock-cards/${sku}/location`, {
      toLocation: newLocation,
      changedBy: state.currentUser?.fullName || "Bilinmeyen",
      note,
    });
    await refreshData();
    state.expandedCardSku = null;
    renderAll();
  } catch (error) {
    alert("Lokasyon güncellenemedi. API bağlantısını kontrol edin.");
  }
}

function bindCardEvents() {
  const container = byId("searchResults");

  container.querySelectorAll("[data-open-editor]").forEach((row) => {
    row.addEventListener("click", () => {
      const sku = row.dataset.openEditor;
      state.expandedCardSku = state.expandedCardSku === sku ? null : sku;
      renderSearchResults();
    });
  });

  container.querySelectorAll("input[data-sku-checkbox]").forEach((checkbox) => {
    checkbox.addEventListener("click", (e) => e.stopPropagation());
    checkbox.addEventListener("change", () => {
      const sku = checkbox.dataset.skuCheckbox;
      if (checkbox.checked) state.selectedSkus.add(sku);
      else state.selectedSkus.delete(sku);
      renderBulkUpdateState();
    });
  });

  container.querySelectorAll("form[data-card-form]").forEach((form) => {
    form.addEventListener("click", (e) => e.stopPropagation());
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      updateStockCardLocation(form.dataset.cardForm);
    });
  });
}

function renderHistory() {
  const filter = normalizeText(byId("historyFilter").value || "");

  const filtered = state.movements
    .filter((m) => {
      if (!filter) return true;
      return `${m.sku} ${m.productName} ${m.brand} ${m.barcode} ${m.size}`
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
    .map(
      (m) => `
        <article class="item">
        <strong>SKU: ${m.sku} • ${m.productName}</strong><br>
        <span class="muted">Marka: ${m.brand} • Barkod: ${m.barcode || "-"} • Beden: ${m.size || "-"} • Adet: ${m.quantity ?? "-"}</span><br>
        <span>${m.fromLocation} → ${m.toLocation}</span><br>
        <span class="muted">${new Date(m.createdAt).toLocaleString("tr-TR")} • ${m.changedBy}</span>
        ${m.note ? `<br><span class="muted">Not: ${m.note}</span>` : ""}
      </article>
    `
    )
    .join("");
}

function renderLocationsPage() {
  const filter = normalizeText(byId("locationFilter").value || "");
  const locations = state.locations.filter((location) => location.toLocaleLowerCase("tr-TR").includes(filter));

  const container = byId("locationsList");
  if (!locations.length) {
    container.innerHTML = `<div class="muted">Lokasyon bulunamadı.</div>`;
    return;
  }

  container.innerHTML = locations
    .map((locationCode) => {
      const cardsInLocation = state.catalog.filter((card) => card.location === locationCode);

      return `
        <article class="item">
          <strong>${locationCode}</strong><br>
          <span class="muted">Toplam stok kartı: ${cardsInLocation.length}</span>
          <div class="location-products">
            ${
              cardsInLocation.length
                ? cardsInLocation
                    .map(
                      (c) =>
                        `<div>• SKU ${c.sku} - ${c.productName} • ${c.brand} • Varyant: ${c.variants.length}</div>`
                    )
                    .join("")
                : '<span class="muted">Bu lokasyonda ürün yok.</span>'
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function renderBulkUpdateState() {
  const count = state.selectedSkus.size;
  byId("selectedCount").textContent = `${count} stok kartı seçili`;
  byId("bulkUpdateCard").classList.toggle("hidden", !state.selectionMode);
}

function attemptLogin(username, password) {
  return seedUsers.find(
    (u) => normalizeText(u.username) === normalizeText(username) && u.password === password
  );
}

function showTab(tabName) {
  const productsView = byId("productsView");
  const locationsView = byId("locationsView");
  const databaseView = byId("databaseView");
  const productsTabBtn = byId("productsTabBtn");
  const locationsTabBtn = byId("locationsTabBtn");
  const databaseTabBtn = byId("databaseTabBtn");

  // Main branch ile UI branch'i tam aynı değilse (ör. database tab yoksa)
  // login sonrası burada patlayıp uygulama açılmıyor gibi görünebilir.
  if (!productsView || !locationsView || !productsTabBtn || !locationsTabBtn) {
    return;
  }

  const productsActive = tabName === "products";
  const locationsActive = tabName === "locations";
  const databaseActive = tabName === "database";
  productsView.classList.toggle("hidden", !productsActive);
  locationsView.classList.toggle("hidden", !locationsActive);
  if (databaseView) databaseView.classList.toggle("hidden", !databaseActive);

  productsTabBtn.classList.toggle("active", productsActive);
  locationsTabBtn.classList.toggle("active", locationsActive);
  if (databaseTabBtn) databaseTabBtn.classList.toggle("active", databaseActive);

  if (locationsActive) renderLocationsPage();
}

async function scanBarcode() {
  const status = byId("barcodeStatus");

  if (!("BarcodeDetector" in window)) {
    status.textContent = "Bu tarayıcı kameradan barkod okumayı desteklemiyor. Barkodu arama kutusuna yazabilirsiniz.";
    return;
  }

  try {
    status.textContent = "Kamera açılıyor...";
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const video = document.createElement("video");
    video.srcObject = stream;
    video.setAttribute("playsinline", true);
    await video.play();

    const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "qr_code"] });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    let foundCode = "";
    const timeoutAt = Date.now() + 7000;

    while (!foundCode && Date.now() < timeoutAt) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const barcodes = await detector.detect(canvas);
      if (barcodes.length) {
        foundCode = barcodes[0].rawValue;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    stream.getTracks().forEach((t) => t.stop());

    if (foundCode) {
      byId("searchInput").value = foundCode;
      renderSearchResults();
      status.textContent = `Barkod okundu: ${foundCode}`;
    } else {
      status.textContent = "Barkod okunamadı. Tekrar deneyin veya elle arayın.";
    }
  } catch (error) {
    status.textContent = "Kamera erişimi alınamadı. İzinleri kontrol edin.";
  }
}

async function refreshData() {
  await loadDataFromApi();
}

function renderAll() {
  populateLocationSelects();
  populateSkuSelect();
  renderSearchResults();
  renderHistory();
  renderBulkUpdateState();
}

async function showApp() {
  byId("loginScreen").classList.add("hidden");
  byId("appScreen").classList.remove("hidden");
  byId("logoutBtn").classList.remove("hidden");
  byId("selectionModeBtn").classList.remove("hidden");

  try {
    await refreshData();
    state.apiOnline = true;
    byId("barcodeStatus").textContent = "Veriler veritabanından yüklendi.";
  } catch (error) {
    state.apiOnline = false;
    byId("barcodeStatus").textContent = "API'ye bağlanılamadı. Önce backend/server.py başlatın.";
    state.catalog = [];
    state.movements = [];
    state.locations = [];
  }

  renderAll();
  showTab("products");
}

function showLogin() {
  byId("loginScreen").classList.remove("hidden");
  byId("appScreen").classList.add("hidden");
  byId("logoutBtn").classList.add("hidden");
  byId("selectionModeBtn").classList.add("hidden");
}

function bindEvents() {
  const loginForm = byId("loginForm");
  if (!loginForm) {
    console.error("loginForm bulunamadı. HTML ile app.js eşleşmiyor olabilir.");
    return;
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = byId("username").value;
    const password = byId("password").value;
    const user = attemptLogin(username, password);

    if (!user) {
      alert("Hatalı kullanıcı veya şifre.");
      return;
    }

    state.currentUser = user;
    await showApp();
  });

  byId("logoutBtn")?.addEventListener("click", () => {
    state.currentUser = null;
    state.expandedCardSku = null;
    state.selectionMode = false;
    state.selectedSkus.clear();
    byId("loginForm").reset();
    showLogin();
  });

  byId("selectionModeBtn")?.addEventListener("click", () => {
    state.selectionMode = !state.selectionMode;
    byId("selectionModeBtn").textContent = state.selectionMode ? "Seçim Modu: Açık" : "Seçim Modu";
    if (!state.selectionMode) state.selectedSkus.clear();
    renderSearchResults();
    renderBulkUpdateState();
  });

  byId("productsTabBtn")?.addEventListener("click", () => showTab("products"));
  byId("locationsTabBtn")?.addEventListener("click", () => showTab("locations"));
  byId("databaseTabBtn")?.addEventListener("click", () => showTab("database"));

  byId("searchInput")?.addEventListener("input", renderSearchResults);
  byId("historyFilter")?.addEventListener("input", renderHistory);
  byId("locationFilter")?.addEventListener("input", renderLocationsPage);
  byId("scanBarcodeBtn")?.addEventListener("click", scanBarcode);

  byId("bulkUpdateForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const selectedIds = Array.from(state.selectedSkus);
    if (!selectedIds.length) {
      alert("Önce en az bir stok kartı seçin.");
      return;
    }

    const targetLocation = byId("bulkLocation").value;
    const note = byId("bulkNote").value.trim();

    try {
      for (const sku of selectedIds) {
        await apiPatch(`/stock-cards/${sku}/location`, {
          toLocation: targetLocation,
          changedBy: state.currentUser?.fullName || "Bilinmeyen",
          note,
        });
      }

      await refreshData();
      state.selectedSkus.clear();
      byId("bulkUpdateForm").reset();
      renderAll();
      renderLocationsPage();
    } catch (error) {
      alert("Toplu güncelleme sırasında API hatası oluştu.");
    }
  });

  byId("createStockCardForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const sku = byId("newSku").value.trim();
    const brand = byId("newBrand").value.trim();
    const productName = byId("newProductName").value.trim();
    const location = byId("newCardLocation").value;

    if (!sku || !brand || !productName || !location) {
      alert("SKU, marka, ürün adı ve lokasyon zorunlu.");
      return;
    }

    try {
      await apiPost("/stock-cards", { sku, brand, productName, location });
      byId("createStockCardForm").reset();
      await refreshData();
      renderAll();
      alert("Stok kartı oluşturuldu.");
    } catch (error) {
      alert("Stok kartı oluşturulamadı. SKU benzersiz olmalıdır.");
    }
  });

  byId("createVariantForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const sku = byId("variantSku").value;
    const barcode = byId("variantBarcode").value.trim();
    const size = byId("variantSize").value.trim();
    const quantity = Number(byId("variantQuantity").value || 0);
    const id = `v_${sku}_${size.toLowerCase()}_${Date.now()}`;

    if (!sku || !barcode || !size) {
      alert("SKU, barkod ve beden zorunlu.");
      return;
    }

    try {
      await apiPost("/variants", { id, sku, barcode, size, quantity });
      byId("createVariantForm").reset();
      await refreshData();
      renderAll();
      alert("Varyant eklendi.");
    } catch (error) {
      alert("Varyant eklenemedi. Barkod benzersiz olmalıdır.");
    }
  });

  byId("downloadTemplateBtn")?.addEventListener("click", downloadImportTemplate);

  byId("importExcelForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = byId("importFileInput").files?.[0];
    if (!file) {
      alert("Lütfen bir CSV dosyası seçin.");
      return;
    }

    try {
      const content = await file.text();
      const rows = parseCsvRows(content);
      if (!rows.length) {
        alert("Dosyada içe aktarılacak satır bulunamadı.");
        return;
      }

      const createdSkus = new Set();
      for (const row of rows) {
        const sku = (row.sku || "").trim();
        const brand = (row.brand || "").trim();
        const productName = (row.productName || "").trim();
        const barcode = (row.barcode || "").trim();
        const size = (row.size || "").trim();
        const quantity = Number(row.quantity || 0);
        const location = (row.location || "").trim();

        if (!sku || !brand || !productName || !location) continue;

        if (!createdSkus.has(sku)) {
          try {
            await apiPost("/stock-cards", { sku, brand, productName, location });
          } catch (_error) {
            // SKU zaten varsa import devam eder.
          }
          createdSkus.add(sku);
        }

        if (!barcode || !size) continue;
        const variantId = `v_${sku}_${size.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        try {
          await apiPost("/variants", {
            id: variantId,
            sku,
            barcode,
            size,
            quantity,
            location,
          });
        } catch (_error) {
          // Varyant/barkod zaten varsa satır atlanır.
        }
      }

      byId("importExcelForm").reset();
      await refreshData();
      renderAll();
      alert("Excel/CSV içe aktarma tamamlandı.");
    } catch (error) {
      alert("İçe aktarma sırasında hata oluştu. Dosya biçimini kontrol edin.");
    }
  });
}

function main() {
  if (!byId("loginScreen") || !byId("appScreen") || !byId("loginForm")) {
    console.error("Kritik UI elemanları bulunamadı. index.html merge edilmiş ama bazı id'ler eksik olabilir.");
    alert("Uygulama dosyaları tam eşleşmiyor. Lütfen cache temizleyip tekrar deneyin veya index.html merge durumunu kontrol edin.");
    return;
  }
  bindEvents();
  showLogin();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
