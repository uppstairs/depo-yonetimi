const seedUsers = [
  { username: "ali", password: "1234", fullName: "Ali" },
  { username: "ayse", password: "1234", fullName: "Ayşe" },
  { username: "mehmet", password: "1234", fullName: "Mehmet" },
  { username: "zeynep", password: "1234", fullName: "Zeynep" },
  { username: "can", password: "1234", fullName: "Can" },
];

const seedLocations = ["A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3", "D1", "D2", "D3"];

const seedCatalog = [
  {
    sku: "1001",
    brand: "Jack Jones",
    productName: "Beyaz Tişört",
    variants: [
      { id: "v1001-xs", barcode: "123456", size: "XS", quantity: 6, location: "A1" },
      { id: "v1001-s", barcode: "234561", size: "S", quantity: 8, location: "A2" },
      { id: "v1001-m", barcode: "345612", size: "M", quantity: 5, location: "B1" },
    ],
  },
  {
    sku: "2002",
    brand: "Mavi",
    productName: "Slim Fit Jean",
    variants: [
      { id: "v2002-30", barcode: "456123", size: "30", quantity: 4, location: "C1" },
      { id: "v2002-32", barcode: "561234", size: "32", quantity: 3, location: "C2" },
      { id: "v2002-34", barcode: "612345", size: "34", quantity: 2, location: "C3" },
    ],
  },
];

const state = {
  currentUser: null,
  expandedVariantId: null,
  selectionMode: false,
  selectedVariantIds: new Set(),
};

function byId(id) {
  return document.getElementById(id);
}

function getStorage(key, fallback) {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : fallback;
}

function setStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function initData() {
  if (!localStorage.getItem("catalog")) setStorage("catalog", seedCatalog);
  if (!localStorage.getItem("movements")) setStorage("movements", []);
  if (!localStorage.getItem("users")) setStorage("users", seedUsers);
  if (!localStorage.getItem("locations")) setStorage("locations", seedLocations);
}

function getCatalog() {
  return getStorage("catalog", []);
}

function setCatalog(catalog) {
  setStorage("catalog", catalog);
}

function getMovements() {
  return getStorage("movements", []);
}

function setMovements(movements) {
  setStorage("movements", movements);
}

function getLocations() {
  return getStorage("locations", []);
}

function normalizeText(value) {
  return value.trim().toLocaleLowerCase("tr-TR");
}

function populateLocationSelects() {
  const locations = getLocations();
  const options = locations.map((loc) => `<option value="${loc}">${loc}</option>`).join("");
  byId("bulkLocation").innerHTML = options;
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
  const cards = getCatalog().filter((card) => matchesQuery(card, query));
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
          const options = getLocations()
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

function findVariantById(catalog, variantId) {
  for (const card of catalog) {
    const variant = card.variants.find((v) => v.id === variantId);
    if (variant) return { card, variant };
  }
  return null;
}

function updateVariantLocation(variantId) {
  const catalog = getCatalog();
  const found = findVariantById(catalog, variantId);
  if (!found) {
    alert("Varyant bulunamadı.");
    return;
  }

  const locationInput = document.querySelector(`[data-variant-location="${variantId}"]`);
  const noteInput = document.querySelector(`[data-variant-note="${variantId}"]`);
  const newLocation = locationInput?.value;
  const note = noteInput?.value?.trim() || "";

  if (!newLocation) {
    alert("Yeni lokasyon seçmelisiniz.");
    return;
  }

  const oldLocation = found.variant.location;
  found.variant.location = newLocation;
  setCatalog(catalog);

  const movements = getMovements();
  movements.push({
    id: `m_${Date.now()}_${variantId}`,
    sku: found.card.sku,
    productName: found.card.productName,
    brand: found.card.brand,
    variantId,
    barcode: found.variant.barcode,
    size: found.variant.size,
    quantity: found.variant.quantity,
    fromLocation: oldLocation,
    toLocation: newLocation,
    changedBy: state.currentUser?.fullName || "Bilinmeyen",
    note,
    createdAt: new Date().toISOString(),
  });
  setMovements(movements);

  state.expandedVariantId = null;
  renderSearchResults();
  renderHistory();
  renderLocationsPage();
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
  const movements = getMovements();
  const filter = normalizeText(byId("historyFilter").value || "");

  const filtered = movements
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
  const catalog = getCatalog();
  const filter = normalizeText(byId("locationFilter").value || "");
  const locations = getLocations().filter((location) =>
    location.toLocaleLowerCase("tr-TR").includes(filter)
  );

  const container = byId("locationsList");
  if (!locations.length) {
    container.innerHTML = `<div class="muted">Lokasyon bulunamadı.</div>`;
    return;
  }

  container.innerHTML = locations
    .map((locationCode) => {
      const variantsInLocation = catalog.flatMap((card) =>
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
  const users = getStorage("users", []);
  return users.find(
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

function showApp() {
  byId("loginScreen").classList.add("hidden");
  byId("appScreen").classList.remove("hidden");
  byId("logoutBtn").classList.remove("hidden");
  byId("selectionModeBtn").classList.remove("hidden");

  populateLocationSelects();
  renderSearchResults();
  renderHistory();
  renderBulkUpdateState();
  showTab("products");
}

function showLogin() {
  byId("loginScreen").classList.remove("hidden");
  byId("appScreen").classList.add("hidden");
  byId("logoutBtn").classList.add("hidden");
  byId("selectionModeBtn").classList.add("hidden");
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

  byId("bulkUpdateForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const selectedIds = Array.from(state.selectedVariantIds);
    if (!selectedIds.length) {
      alert("Önce en az bir varyant seçin.");
      return;
    }

    const targetLocation = byId("bulkLocation").value;
    const note = byId("bulkNote").value.trim();
    const catalog = getCatalog();
    const movements = getMovements();

    selectedIds.forEach((variantId) => {
      const found = findVariantById(catalog, variantId);
      if (!found) return;

      const oldLocation = found.variant.location;
      found.variant.location = targetLocation;

      movements.push({
        id: `m_${Date.now()}_${variantId}`,
        sku: found.card.sku,
        productName: found.card.productName,
        brand: found.card.brand,
        variantId,
        barcode: found.variant.barcode,
        size: found.variant.size,
        quantity: found.variant.quantity,
        fromLocation: oldLocation,
        toLocation: targetLocation,
        changedBy: state.currentUser?.fullName || "Bilinmeyen",
        note,
        createdAt: new Date().toISOString(),
      });
    });

    setCatalog(catalog);
    setMovements(movements);

    state.selectedVariantIds.clear();
    byId("bulkUpdateForm").reset();
    renderSearchResults();
    renderBulkUpdateState();
    renderHistory();
    renderLocationsPage();
  });
}

function main() {
  initData();
  bindEvents();
  showLogin();
}

main();
