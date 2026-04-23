const seedUsers = [
  { username: "ali", password: "1234", fullName: "Ali" },
  { username: "ayse", password: "1234", fullName: "Ayşe" },
  { username: "mehmet", password: "1234", fullName: "Mehmet" },
  { username: "zeynep", password: "1234", fullName: "Zeynep" },
  { username: "can", password: "1234", fullName: "Can" },
];

const seedLocations = ["A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3", "D1", "D2", "D3"];

const seedProducts = [
  {
    id: "p1",
    stockCode: "STK-ELB-001",
    sku: "SKU-1001-S",
    barcode: "869000000001",
    name: "Basic Tişört",
    size: "S",
    brand: "Northline",
    currentLocation: "A1",
  },
  {
    id: "p2",
    stockCode: "STK-ELB-001",
    sku: "SKU-1001-M",
    barcode: "869000000002",
    name: "Basic Tişört",
    size: "M",
    brand: "Northline",
    currentLocation: "A2",
  },
  {
    id: "p3",
    stockCode: "STK-ELB-001",
    sku: "SKU-1001-L",
    barcode: "869000000003",
    name: "Basic Tişört",
    size: "L",
    brand: "Northline",
    currentLocation: "B1",
  },
  {
    id: "p4",
    stockCode: "STK-PNT-014",
    sku: "SKU-2001-32",
    barcode: "869000000004",
    name: "Slim Jean",
    size: "32",
    brand: "BlueOak",
    currentLocation: "C3",
  },
  {
    id: "p5",
    stockCode: "STK-PNT-014",
    sku: "SKU-2001-34",
    barcode: "869000000005",
    name: "Slim Jean",
    size: "34",
    brand: "BlueOak",
    currentLocation: "D2",
  },
];

const state = {
  currentUser: null,
  selectedProductId: null,
  selectionMode: false,
  selectedProductIds: new Set(),
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
  if (!localStorage.getItem("products")) setStorage("products", seedProducts);
  if (!localStorage.getItem("movements")) setStorage("movements", []);
  if (!localStorage.getItem("users")) setStorage("users", seedUsers);
  if (!localStorage.getItem("locations")) setStorage("locations", seedLocations);
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

function renderSearchResults() {
  const query = normalizeText(byId("searchInput").value || "");
  const products = getProducts();

  const filtered = !query
    ? products
    : products.filter((p) =>
        `${p.name} ${p.sku} ${p.stockCode} ${p.brand} ${p.size} ${p.barcode}`
          .toLocaleLowerCase("tr-TR")
          .includes(query)
      );

  const container = byId("searchResults");
  if (!filtered.length) {
    container.innerHTML = `<div class="muted">Eşleşen ürün bulunamadı.</div>`;
    return;
  }

  container.innerHTML = filtered
    .map((p) => {
      const checked = state.selectedProductIds.has(p.id) ? "checked" : "";
      const options = getLocations()
        .map((loc) => `<option value="${loc}" ${loc === p.currentLocation ? "selected" : ""}>${loc}</option>`)
        .join("");
      const inlineEditor =
        state.selectedProductId === p.id
          ? `
            <form class="stack inline-editor" data-inline-form-id="${p.id}">
              <label>
                Yeni Lokasyon
                <select data-inline-location-id="${p.id}" required>${options}</select>
              </label>
              <label>
                Not
                <input data-inline-note-id="${p.id}" placeholder="Opsiyonel" />
              </label>
              <button type="submit">Lokasyonu Güncelle</button>
            </form>
          `
          : "";
      return `
        <article class="item">
          <div class="item-head">
            <strong>${p.name}</strong>
            ${state.selectionMode ? `<input type="checkbox" data-checkbox-id="${p.id}" ${checked} />` : ""}
          </div>
          <span class="muted">${p.sku} • Barkod: ${p.barcode}</span><br>
          <span class="muted">Stok Kartı: ${p.stockCode} • Marka: ${p.brand}</span><br>
          <span class="muted">Beden: ${p.size}</span><br>
          <span class="muted">Lokasyon: ${p.currentLocation}</span>
          <button type="button" data-product-id="${p.id}">Değiştir</button>
          ${inlineEditor}
        </article>
      `;
    })
    .join("");

  container.querySelectorAll("button[data-product-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selectedId = btn.dataset.productId;
      state.selectedProductId = state.selectedProductId === selectedId ? null : selectedId;
      renderSearchResults();
    });
  });

  container.querySelectorAll("input[data-checkbox-id]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const productId = checkbox.dataset.checkboxId;
      if (checkbox.checked) state.selectedProductIds.add(productId);
      else state.selectedProductIds.delete(productId);
      renderBulkUpdateState();
    });
  });

  container.querySelectorAll("form[data-inline-form-id]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const productId = form.dataset.inlineFormId;
      updateSingleProductLocation(productId);
    });
  });
}

function updateSingleProductLocation(productId) {
  const products = getProducts();
  const idx = products.findIndex((p) => p.id === productId);
  if (idx < 0) {
    alert("Ürün bulunamadı.");
    return;
  }

  const locationInput = document.querySelector(`[data-inline-location-id="${productId}"]`);
  const noteInput = document.querySelector(`[data-inline-note-id="${productId}"]`);
  const newLocation = locationInput?.value;
  const note = noteInput?.value?.trim() || "";

  if (!newLocation) {
    alert("Yeni lokasyon seçmelisiniz.");
    return;
  }

  const oldLocation = products[idx].currentLocation;
  products[idx].currentLocation = newLocation;
  setProducts(products);

  const movements = getMovements();
  movements.push({
    id: `m_${Date.now()}_${productId}`,
    productId,
    fromLocation: oldLocation,
    toLocation: newLocation,
    changedBy: state.currentUser?.fullName || "Bilinmeyen",
    note,
    createdAt: new Date().toISOString(),
  });
  setMovements(movements);

  state.selectedProductId = null;
  renderSearchResults();
  renderHistory();
  renderLocationsPage();
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
        stockCode: product?.stockCode || "-",
        size: product?.size || "-",
        brand: product?.brand || "-",
      };
    })
    .filter((m) => {
      if (!filter) return true;
      return `${m.productName} ${m.sku} ${m.stockCode} ${m.brand} ${m.size}`
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
        <span class="muted">${m.sku} • Stok Kartı: ${m.stockCode}</span><br>
        <span class="muted">Marka: ${m.brand} • Beden: ${m.size}</span><br>
        <span>${m.fromLocation} → ${m.toLocation}</span><br>
        <span class="muted">${new Date(m.createdAt).toLocaleString("tr-TR")} • ${m.changedBy}</span>
        ${m.note ? `<br><span class="muted">Not: ${m.note}</span>` : ""}
      </article>
    `
    )
    .join("");
}

function renderLocationsPage() {
  const products = getProducts();
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
      const inLocation = products.filter((p) => p.currentLocation === locationCode);
      return `
        <article class="item">
          <strong>${locationCode}</strong><br>
          <span class="muted">Toplam: ${inLocation.length} ürün</span>
          <div class="location-products">
            ${
              inLocation.length
                ? inLocation
                    .map(
                      (p) =>
                        `<div>• ${p.name} (${p.sku}) • ${p.brand} • Beden ${p.size} • ${p.stockCode}</div>`
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
  const count = state.selectedProductIds.size;
  byId("selectedCount").textContent = `${count} ürün seçili`;
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
    state.selectedProductId = null;
    state.selectionMode = false;
    state.selectedProductIds.clear();
    byId("loginForm").reset();
    showLogin();
  });

  byId("selectionModeBtn").addEventListener("click", () => {
    state.selectionMode = !state.selectionMode;
    byId("selectionModeBtn").textContent = state.selectionMode ? "Seçim Modu: Açık" : "Seçim Modu";
    if (!state.selectionMode) state.selectedProductIds.clear();
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
    const selectedIds = Array.from(state.selectedProductIds);
    if (!selectedIds.length) {
      alert("Önce en az bir ürün seçin.");
      return;
    }

    const targetLocation = byId("bulkLocation").value;
    const note = byId("bulkNote").value.trim();
    const products = getProducts();
    const movements = getMovements();

    selectedIds.forEach((productId) => {
      const idx = products.findIndex((p) => p.id === productId);
      if (idx < 0) return;

      const oldLocation = products[idx].currentLocation;
      products[idx].currentLocation = targetLocation;

      movements.push({
        id: `m_${Date.now()}_${productId}`,
        productId,
        fromLocation: oldLocation,
        toLocation: targetLocation,
        changedBy: state.currentUser?.fullName || "Bilinmeyen",
        note,
        createdAt: new Date().toISOString(),
      });
    });

    setProducts(products);
    setMovements(movements);

    state.selectedProductIds.clear();
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
