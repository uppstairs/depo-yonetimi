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
  expandedVariantId: null,
  selectionMode: false,
  selectedVariantIds: new Set(),
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

function populateLocationSelects() {
  const options = state.locations.map((loc) => `<option value="${loc}">${loc}</option>`).join("");
  byId("bulkLocation").innerHTML = options;
  byId("variantLocation").innerHTML = options;
}

function populateSkuSelect() {
  const options = state.catalog.map((card) => `<option value="${card.sku}">${card.sku} - ${card.productName}</option>`);
  byId("variantSku").innerHTML = options.join("");
}

function matchesQuery(card, query) {
  if (!query) return true;
  const cardText = `${card.sku} ${card.brand} ${card.productName}`.toLocaleLowerCase("tr-TR");
  const variantText = card.variants
    .map((v) => `${v.barcode} ${v.size} ${v.location} ${v.quantity}`)
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
      const variantsHtml = card.variants
        .map((variant) => {
          const checked = state.selectedVariantIds.has(variant.id) ? "checked" : "";
          const editorOpen = state.expandedVariantId === variant.id;
          const options = state.locations
            .map(
              (loc) => `<option value="${loc}" ${loc === variant.location ? "selected" : ""}>${loc}</option>`
            )
            .join("");

          return `
            <div class="variant-row" data-open-editor="${variant.id}">
              <div class="variant-head">
                <div>
                  <span><strong>Barkod:</strong> ${variant.barcode}</span><br>
                  <span class="muted"><strong>Beden:</strong> ${variant.size} • <strong>Adet:</strong> ${variant.quantity} • <strong>Lokasyon:</strong> ${variant.location}</span>
                </div>
                ${state.selectionMode ? `<input type="checkbox" data-variant-checkbox="${variant.id}" ${checked} />` : ""}
              </div>
              ${
                editorOpen
                  ? `<form class="stack inline-editor" data-variant-form="${variant.id}">
                      <label>
                        Yeni Lokasyon
                        <select data-variant-location="${variant.id}" required>${options}</select>
                      </label>
                      <label>
                        Not
                        <input data-variant-note="${variant.id}" placeholder="Opsiyonel" />
                      </label>
                      <button type="submit">Varyant Lokasyonunu Güncelle</button>
                    </form>`
                  : ""
              }
            </div>
          `;
        })
        .join("");

      return `
        <article class="item">
          <strong>SKU: ${card.sku}</strong><br>
          <span class="muted">Marka: ${card.brand}</span><br>
          <span class="muted">Ürün Adı: ${card.productName}</span>
          <div class="variant-list">${variantsHtml}</div>
        </article>
      `;
    })
    .join("");

  bindCardEvents();
}

function findVariantById(variantId) {
  for (const card of state.catalog) {
    const variant = card.variants.find((v) => v.id === variantId);
    if (variant) return { card, variant };
  }
  return null;
}

async function updateVariantLocation(variantId) {
  const locationInput = document.querySelector(`[data-variant-location="${variantId}"]`);
  const noteInput = document.querySelector(`[data-variant-note="${variantId}"]`);
  const newLocation = locationInput?.value;
  const note = noteInput?.value?.trim() || "";

  if (!newLocation) {
    alert("Yeni lokasyon seçmelisiniz.");
    return;
  }

  try {
    await apiPatch(`/variants/${variantId}/location`, {
      toLocation: newLocation,
      changedBy: state.currentUser?.fullName || "Bilinmeyen",
      note,
    });
    await refreshData();
    state.expandedVariantId = null;
    renderAll();
  } catch (error) {
    alert("Lokasyon güncellenemedi. API bağlantısını kontrol edin.");
  }
}

function bindCardEvents() {
  const container = byId("searchResults");

  container.querySelectorAll("[data-open-editor]").forEach((row) => {
    row.addEventListener("click", () => {
      const variantId = row.dataset.openEditor;
      state.expandedVariantId = state.expandedVariantId === variantId ? null : variantId;
      renderSearchResults();
    });
  });

  container.querySelectorAll("input[data-variant-checkbox]").forEach((checkbox) => {
    checkbox.addEventListener("click", (e) => e.stopPropagation());
    checkbox.addEventListener("change", () => {
      const variantId = checkbox.dataset.variantCheckbox;
      if (checkbox.checked) state.selectedVariantIds.add(variantId);
      else state.selectedVariantIds.delete(variantId);
      renderBulkUpdateState();
    });
  });

  container.querySelectorAll("form[data-variant-form]").forEach((form) => {
    form.addEventListener("click", (e) => e.stopPropagation());
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      updateVariantLocation(form.dataset.variantForm);
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
        <span class="muted">Marka: ${m.brand} • Barkod: ${m.barcode} • Beden: ${m.size} • Adet: ${m.quantity}</span><br>
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
      const variantsInLocation = state.catalog.flatMap((card) =>
        card.variants
          .filter((v) => v.location === locationCode)
          .map((v) => ({ ...v, sku: card.sku, brand: card.brand, productName: card.productName }))
      );

      return `
        <article class="item">
          <strong>${locationCode}</strong><br>
          <span class="muted">Toplam varyant: ${variantsInLocation.length}</span>
          <div class="location-products">
            ${
              variantsInLocation.length
                ? variantsInLocation
                    .map(
                      (v) =>
                        `<div>• SKU ${v.sku} - ${v.productName} • ${v.brand} • Barkod ${v.barcode} • Beden ${v.size} • Adet ${v.quantity}</div>`
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
  const count = state.selectedVariantIds.size;
  byId("selectedCount").textContent = `${count} varyant seçili`;
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
  const productsTabBtn = byId("productsTabBtn");
  const locationsTabBtn = byId("locationsTabBtn");

  const productsActive = tabName === "products";
  productsView.classList.toggle("hidden", !productsActive);
  locationsView.classList.toggle("hidden", productsActive);

  productsTabBtn.classList.toggle("active", productsActive);
  locationsTabBtn.classList.toggle("active", !productsActive);

  if (!productsActive) renderLocationsPage();
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
  byId("loginForm").addEventListener("submit", async (e) => {
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

  byId("logoutBtn").addEventListener("click", () => {
    state.currentUser = null;
    state.expandedVariantId = null;
    state.selectionMode = false;
    state.selectedVariantIds.clear();
    byId("loginForm").reset();
    showLogin();
  });

  byId("selectionModeBtn").addEventListener("click", () => {
    state.selectionMode = !state.selectionMode;
    byId("selectionModeBtn").textContent = state.selectionMode ? "Seçim Modu: Açık" : "Seçim Modu";
    if (!state.selectionMode) state.selectedVariantIds.clear();
    renderSearchResults();
    renderBulkUpdateState();
  });

  byId("productsTabBtn").addEventListener("click", () => showTab("products"));
  byId("locationsTabBtn").addEventListener("click", () => showTab("locations"));

  byId("searchInput").addEventListener("input", renderSearchResults);
  byId("historyFilter").addEventListener("input", renderHistory);
  byId("locationFilter").addEventListener("input", renderLocationsPage);
  byId("scanBarcodeBtn").addEventListener("click", scanBarcode);

  byId("bulkUpdateForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const selectedIds = Array.from(state.selectedVariantIds);
    if (!selectedIds.length) {
      alert("Önce en az bir varyant seçin.");
      return;
    }

    const targetLocation = byId("bulkLocation").value;
    const note = byId("bulkNote").value.trim();

    try {
      for (const variantId of selectedIds) {
        await apiPatch(`/variants/${variantId}/location`, {
          toLocation: targetLocation,
          changedBy: state.currentUser?.fullName || "Bilinmeyen",
          note,
        });
      }

      await refreshData();
      state.selectedVariantIds.clear();
      byId("bulkUpdateForm").reset();
      renderAll();
      renderLocationsPage();
    } catch (error) {
      alert("Toplu güncelleme sırasında API hatası oluştu.");
    }
  });

  byId("createStockCardForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const sku = byId("newSku").value.trim();
    const brand = byId("newBrand").value.trim();
    const productName = byId("newProductName").value.trim();

    if (!sku || !brand || !productName) {
      alert("SKU, marka ve ürün adı zorunlu.");
      return;
    }

    try {
      await apiPost("/stock-cards", { sku, brand, productName });
      byId("createStockCardForm").reset();
      await refreshData();
      renderAll();
      alert("Stok kartı oluşturuldu.");
    } catch (error) {
      alert("Stok kartı oluşturulamadı. SKU benzersiz olmalıdır.");
    }
  });

  byId("createVariantForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const sku = byId("variantSku").value;
    const barcode = byId("variantBarcode").value.trim();
    const size = byId("variantSize").value.trim();
    const quantity = Number(byId("variantQuantity").value || 0);
    const location = byId("variantLocation").value;
    const id = `v_${sku}_${size.toLowerCase()}_${Date.now()}`;

    if (!sku || !barcode || !size || !location) {
      alert("SKU, barkod, beden ve lokasyon zorunlu.");
      return;
    }

    try {
      await apiPost("/variants", { id, sku, barcode, size, quantity, location });
      byId("createVariantForm").reset();
      await refreshData();
      renderAll();
      alert("Varyant eklendi.");
    } catch (error) {
      alert("Varyant eklenemedi. Barkod benzersiz olmalıdır.");
    }
  });
}

function main() {
  bindEvents();
  showLogin();
}

main();
