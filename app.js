"use strict";

/* ==========================================
   VESTIAMOCIALTAMODA
   E-COMMERCE APPLICATION
========================================== */

const CONFIG = {
  storeName: "VESTIAMOCIALTAMODA",

  contacts: {
    telegram: "",  // Es: https://t.me/tuonome
    signal: "",    // Inserire link Signal valido
    whatsapp: ""   // Es: https://wa.me/393XXXXXXXXX
  },

  meetupZones: [
    // Inserire le zone disponibili.
    // Esempio: "Zona Centro"
  ],

  productsFile: "./data/products.json",
  reviewsFile: "./data/reviews.json",

  cartKey: "vestiamocialtamoda_cart_v1",

  splashDuration: 1800
};

/* ==========================================
   STATO APPLICAZIONE
========================================== */

let products = [];
let reviews = [];
let cart = [];

let currentCategory = "all";
let searchQuery = "";

let toastTimer = null;

/* ==========================================
   HELPERS
========================================== */

const $ = id => document.getElementById(id);

function money(value) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value) || 0);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showToast(message) {
  const toast = $("toast");
  if (!toast) return;

  clearTimeout(toastTimer);

  toast.textContent = message;
  toast.classList.add("show");

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function safeUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(url, location.href);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }

    return parsed.href;
  } catch {
    return "";
  }
}

function validPrice(value) {
  return Number.isFinite(Number(value)) &&
         Number(value) >= 0;
}

/* ==========================================
   NAVIGAZIONE
========================================== */

const pages = [
  "home",
  "vetrina",
  "recensioni",
  "contatto",
  "info",
  "carrello",
  "checkout"
];

function showPage(pageName) {
  if (!pages.includes(pageName)) {
    pageName = "home";
  }

  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle(
      "active",
      page.id === pageName
    );
  });

  window.scrollTo({
    top: 0,
    behavior: "instant"
  });

  if (pageName === "carrello") {
    renderCart();
  }

  if (pageName === "checkout") {
    if (!cart.length) {
      showToast("Il carrello è vuoto");
      showPage("carrello");
      return;
    }

    renderCheckout();
  }

  if (pageName === "recensioni") {
    renderReviews();
  }
}

function setupNavigation() {
  document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      showPage(button.dataset.page);
    });
  });

  $("homeBtn")?.addEventListener("click", () => {
    showPage("home");
  });

  $("cartBtn")?.addEventListener("click", () => {
    showPage("carrello");
  });

  $("checkoutBtn")?.addEventListener("click", () => {
    showPage("checkout");
  });
}

/* ==========================================
   SPLASH SCREEN
========================================== */

function setupSplash() {
  const splash = $("splash");

  if (!splash) return;

  setTimeout(() => {
    splash.classList.add("hidden");

    setTimeout(() => {
      splash.remove();
    }, 600);

  }, CONFIG.splashDuration);
}

/* ==========================================
   CARICAMENTO DATI
========================================== */

async function loadJSON(path) {
  try {
    const response = await fetch(path, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    return Array.isArray(data) ? data : [];

  } catch (error) {
    console.warn("Impossibile caricare:", path, error);
    return [];
  }
}

async function loadProducts() {
  const data = await loadJSON(CONFIG.productsFile);

  products = data.filter(product => {
    return product &&
      product.id != null &&
      product.name &&
      Array.isArray(product.variants);
  });

  renderCategories();
  renderProducts();
  validateCart();
}

async function loadReviews() {
  reviews = await loadJSON(CONFIG.reviewsFile);
  renderReviews();
}

/* ==========================================
   CATEGORIE
========================================== */

function getCategories() {
  return [...new Set(
    products
      .map(product => product.category)
      .filter(Boolean)
  )];
}

function renderCategories() {
  const container = $("categoryButtons");
  const select = $("categoryFilter");

  if (!container || !select) return;

  const categories = getCategories();

  container.innerHTML = "";

  select.innerHTML =
    '<option value="all">Tutte le categorie</option>';

  const allButton = document.createElement("button");

  allButton.type = "button";
  allButton.className = "category-button";
  allButton.textContent = "Tutti";

  allButton.addEventListener("click", () => {
    setCategory("all");
  });

  container.appendChild(allButton);

  categories.forEach(category => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "category-button";
    button.textContent = category;

    button.addEventListener("click", () => {
      setCategory(category);
    });

    container.appendChild(button);

    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;

    select.appendChild(option);
  });

  updateCategoryButtons();
}

function setCategory(category) {
  currentCategory = category;

  $("categoryFilter").value = category;

  updateCategoryButtons();
  renderProducts();
}

function updateCategoryButtons() {
  const buttons =
    document.querySelectorAll(".category-button");

  buttons.forEach(button => {
    const category =
      button.textContent === "Tutti"
        ? "all"
        : button.textContent;

    button.classList.toggle(
      "active",
      category === currentCategory
    );
  });
}

function setupFilters() {
  $("productSearch")?.addEventListener("input", event => {
    searchQuery = event.target.value
      .trim()
      .toLowerCase();

    renderProducts();
  });

  $("categoryFilter")?.addEventListener("change", event => {
    setCategory(event.target.value);
  });
}

/* ==========================================
   VARIANTI E PREZZI
========================================== */

function getVariants(product) {
  return product.variants.filter(variant => {
    return variant &&
      variant.label &&
      validPrice(variant.price);
  });
}

function getVariant(product, index) {
  return getVariants(product)[Number(index)] || null;
}

function calculatePrice(variant, quantity) {
  if (!variant) return 0;

  return Number(variant.price) * quantity;
}

/* ==========================================
   VETRINA
========================================== */

function renderProducts() {
  const grid = $("productsGrid");
  const empty = $("productsEmpty");

  if (!grid || !empty) return;

  grid.innerHTML = "";

  const filtered = products.filter(product => {
    const categoryMatch =
      currentCategory === "all" ||
      product.category === currentCategory;

    const searchable = [
      product.name,
      product.description,
      product.category,
      product.brand
    ].join(" ").toLowerCase();

    return categoryMatch &&
      searchable.includes(searchQuery);
  });

  empty.hidden = filtered.length > 0;

  filtered.forEach(product => {
    const variants = getVariants(product);

    if (!variants.length) return;

    const card = document.createElement("article");
    card.className = "product-card";

    const media = document.createElement("div");
    media.className = "product-media";

    const videoUrl = safeUrl(product.video);
    const imageUrl = safeUrl(product.image);

    if (videoUrl) {
      const video = document.createElement("video");

      video.src = videoUrl;
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";

      if (imageUrl) {
        video.poster = imageUrl;
      }

      media.appendChild(video);

    } else if (imageUrl) {
      const image = document.createElement("img");

      image.src = imageUrl;
      image.alt = product.name;
      image.loading = "lazy";

      media.appendChild(image);

    } else {
      media.innerHTML =
        '<div class="empty-state">Nessun video disponibile</div>';
    }

    const content = document.createElement("div");
    content.className = "product-content";

    content.innerHTML = `
      <h3 class="product-name">
        ${escapeHTML(product.name)}
      </h3>

      <p class="product-description">
        ${escapeHTML(product.description || "")}
      </p>

      <label>
        Seleziona formato
        <select class="product-select variant-select">
          ${variants.map((variant, index) => `
            <option value="${index}">
              ${escapeHTML(variant.label)}
              — ${money(variant.price)}
            </option>
          `).join("")}
        </select>
      </label>

      <div class="quantity-control">
        <button type="button" class="qty-minus">−</button>
        <span class="qty-value">1</span>
        <button type="button" class="qty-plus">+</button>
      </div>

      <div class="product-price">
        ${money(variants[0].price)}
      </div>

      <button type="button" class="add-cart-button">
        🛒 AGGIUNGI AL CARRELLO
      </button>
    `;

    card.appendChild(media);
    card.appendChild(content);

    grid.appendChild(card);

    const select = content.querySelector(".variant-select");
    const quantityEl = content.querySelector(".qty-value");
    const priceEl = content.querySelector(".product-price");

    let quantity = 1;

    function updatePrice() {
      const variant = getVariant(product, select.value);

      quantityEl.textContent = quantity;
      priceEl.textContent = money(
        calculatePrice(variant, quantity)
      );
    }

    content.querySelector(".qty-minus").onclick = () => {
      quantity = Math.max(1, quantity - 1);
      updatePrice();
    };

    content.querySelector(".qty-plus").onclick = () => {
      quantity = Math.min(999, quantity + 1);
      updatePrice();
    };

    select.addEventListener("change", updatePrice);

    content.querySelector(".add-cart-button").onclick = () => {
      addToCart(product, Number(select.value), quantity);
    };
  });
}

/* ==========================================
   CARRELLO - SALVATAGGIO
========================================== */

function saveCart() {
  try {
    localStorage.setItem(
      CONFIG.cartKey,
      JSON.stringify(cart)
    );
  } catch (error) {
    console.warn("Carrello non salvato:", error);
  }
}

function loadCart() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(CONFIG.cartKey) || "[]"
    );

    cart = Array.isArray(saved) ? saved : [];

  } catch {
    cart = [];
  }

  updateCartCount();
}

function validateCart() {
  cart = cart.filter(item => {
    const product = products.find(
      p => String(p.id) === String(item.productId)
    );

    if (!product) return false;

    const variant = getVariant(product, item.variantIndex);

    return Boolean(variant) &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0;
  });

  saveCart();
  updateCartCount();
}

/* ==========================================
   AGGIUNGI AL CARRELLO
========================================== */

function addToCart(product, variantIndex, quantity) {
  const variant = getVariant(product, variantIndex);

  if (!variant) {
    showToast("Formato non disponibile");
    return;
  }

  const existing = cart.find(item =>
    String(item.productId) === String(product.id) &&
    item.variantIndex === variantIndex
  );

  if (existing) {
    existing.quantity = Math.min(
      999,
      existing.quantity + quantity
    );

  } else {
    cart.push({
      productId: product.id,
      variantIndex,
      quantity
    });
  }

  saveCart();
  updateCartCount();

  showToast("✅ Prodotto aggiunto al carrello");
}

function updateCartCount() {
  const count = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  if ($("cartCount")) {
    $("cartCount").textContent = count;
  }
}

/* ==========================================
   DATI CARRELLO
========================================== */

function getCartDetails() {
  return cart.map((item, index) => {
    const product = products.find(
      p => String(p.id) === String(item.productId)
    );

    if (!product) return null;

    const variant = getVariant(
      product,
      item.variantIndex
    );

    if (!variant) return null;

    return {
      index,
      product,
      variant,
      quantity: item.quantity,
      subtotal: calculatePrice(
        variant,
        item.quantity
      )
    };
  }).filter(Boolean);
}

function getCartTotal() {
  return getCartDetails().reduce(
    (total, item) => total + item.subtotal,
    0
  );
}

/* ==========================================
   RENDER CARRELLO
========================================== */

function renderCart() {
  const container = $("cartItems");
  const empty = $("cartEmpty");
  const summary = $("cartSummary");

  if (!container) return;

  container.innerHTML = "";

  const details = getCartDetails();

  empty.hidden = details.length > 0;
  summary.hidden = details.length === 0;

  details.forEach(item => {
    const row = document.createElement("article");
    row.className = "cart-item";

    const imageUrl = safeUrl(item.product.image);

    if (imageUrl) {
      const img = document.createElement("img");

      img.src = imageUrl;
      img.alt = item.product.name;

      row.appendChild(img);
    }

    const content = document.createElement("div");
    content.className = "cart-item-content";

    content.innerHTML = `
      <h3>${escapeHTML(item.product.name)}</h3>

      <p>
        Formato:
        <strong>${escapeHTML(item.variant.label)}</strong>
      </p>

      <p>
        Prezzo unitario:
        ${money(item.variant.price)}
      </p>

      <div class="quantity-control">
        <button type="button" class="minus">−</button>
        <span>${item.quantity}</span>
        <button type="button" class="plus">+</button>
      </div>

      <strong>${money(item.subtotal)}</strong>

      <button type="button" class="secondary-button remove">
        🗑️ Rimuovi
      </button>
    `;

    row.appendChild(content);
    container.appendChild(row);

    content.querySelector(".minus").onclick = () => {
      changeCartQuantity(item.index, -1);
    };

    content.querySelector(".plus").onclick = () => {
      changeCartQuantity(item.index, 1);
    };

    content.querySelector(".remove").onclick = () => {
      removeCartItem(item.index);
    };
  });

  $("cartTotal").textContent = money(getCartTotal());
}

function changeCartQuantity(index, change) {
  if (!cart[index]) return;

  cart[index].quantity += change;

  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  } else {
    cart[index].quantity = Math.min(
      999,
      cart[index].quantity
    );
  }

  saveCart();
  updateCartCount();
  renderCart();
}

function removeCartItem(index) {
  cart.splice(index, 1);

  saveCart();
  updateCartCount();
  renderCart();

  showToast("Prodotto rimosso");
}

function clearCart() {
  if (!cart.length) return;

  if (!confirm("Vuoi svuotare il carrello?")) {
    return;
  }

  cart = [];

  saveCart();
  updateCartCount();
  renderCart();

  showToast("Carrello svuotato");
}

/* ==========================================
   CHECKOUT
========================================== */

function renderCheckout() {
  const container = $("checkoutItems");

  if (!container) return;

  const details = getCartDetails();

  container.innerHTML = details.map(item => `
    <div class="checkout-product">
      <p>
        <strong>${escapeHTML(item.product.name)}</strong>
        <br>
        ${escapeHTML(item.variant.label)}
        × ${item.quantity}
      </p>

      <strong>${money(item.subtotal)}</strong>
    </div>
  `).join("");

  $("checkoutTotal").textContent = money(getCartTotal());
}

/* ==========================================
   METODI DI CONSEGNA
========================================== */

function setupDeliveryMethods() {
  const radios = document.querySelectorAll(
    'input[name="deliveryMethod"]'
  );

  radios.forEach(radio => {
    radio.addEventListener("change", () => {
      updateDeliveryFields(radio.value);
    });
  });

  updateMeetupZones();
}

function updateDeliveryFields(method) {
  const sections = {
    spedizione: $("shippingFields"),
    meetup: $("meetupFields"),
    delivery: $("deliveryFields")
  };

  Object.entries(sections).forEach(([name, section]) => {
    if (!section) return;

    const active = name === method;

    section.hidden = !active;

    section.querySelectorAll(
      "input, select, textarea"
    ).forEach(field => {
      field.disabled = !active;

      if (field.name !== "shippingNotes" &&
          field.name !== "deliveryNotes" &&
          field.name !== "shippingCourier") {
        field.required = active;
      }
    });
  });
}

function updateMeetupZones() {
  const select = $("meetupZone");

  if (!select) return;

  select.innerHTML =
    '<option value="">Seleziona una zona</option>';

  CONFIG.meetupZones.forEach(zone => {
    const option = document.createElement("option");

    option.value = zone;
    option.textContent = zone;

    select.appendChild(option);
  });
}

/* ==========================================
   VALIDAZIONE CHECKOUT
========================================== */

function getSelectedMethod() {
  return document.querySelector(
    'input[name="deliveryMethod"]:checked'
  )?.value || "";
}

function validateCheckout() {
  if (!cart.length) {
    showToast("Il carrello è vuoto");
    return false;
  }

  const method = getSelectedMethod();

  if (!method) {
    showToast("Seleziona un metodo di consegna");
    return false;
  }

  if (
    method === "meetup" &&
    CONFIG.meetupZones.length === 0
  ) {
    showToast("Nessuna zona Meet Up disponibile");
    return false;
  }

  const form = $("checkoutForm");

  if (!form.reportValidity()) {
    return false;
  }

  return true;
}

/* ==========================================
   RIEPILOGO ORDINE
========================================== */

function buildOrderMessage() {
  const method = getSelectedMethod();
  const form = $("checkoutForm");
  const data = new FormData(form);

  const details = getCartDetails();

  let message =
    `🛍️ ${CONFIG.storeName}\n` +
    `RICHIESTA ORDINE\n\n`;

  message += "📦 PRODOTTI\n\n";

  details.forEach((item, index) => {
    message +=
      `${index + 1}. ${item.product.name}\n` +
      `Formato: ${item.variant.label}\n` +
      `Quantità: ${item.quantity}\n` +
      `Prezzo unitario: ${money(item.variant.price)}\n` +
      `Subtotale: ${money(item.subtotal)}\n\n`;
  });

  message +=
    `💰 TOTALE PRODOTTI: ${money(getCartTotal())}\n\n`;

  const labels = {
    spedizione: "📦 SPEDIZIONE",
    meetup: "🤝 MEET UP",
    delivery: "🚗 DELIVERY"
  };

  message += `${labels[method]}\n\n`;

  const fields = {
    spedizione: [
      ["Nome", "shippingName"],
      ["Cognome", "shippingSurname"],
      ["Email", "shippingEmail"],
      ["Telefono", "shippingPhone"],
      ["Paese", "shippingCountry"],
      ["Regione", "shippingRegion"],
      ["Provincia", "shippingProvince"],
      ["Città", "shippingCity"],
      ["CAP", "shippingZip"],
      ["Indirizzo", "shippingAddress"],
      ["Corriere", "shippingCourier"],
      ["Note", "shippingNotes"]
    ],

    meetup: [
      ["Zona", "meetupZone"]
    ],

    delivery: [
      ["Nome", "deliveryName"],
      ["Cognome", "deliverySurname"],
      ["Email", "deliveryEmail"],
      ["Telefono", "deliveryPhone"],
      ["Paese", "deliveryCountry"],
      ["Regione", "deliveryRegion"],
      ["Provincia", "deliveryProvince"],
      ["Città", "deliveryCity"],
      ["CAP", "deliveryZip"],
      ["Indirizzo", "deliveryAddress"],
      ["Note", "deliveryNotes"]
    ]
  };

  (fields[method] || []).forEach(([label, key]) => {
    const value = String(data.get(key) || "").trim();

    if (value) {
      message += `${label}: ${value}\n`;
    }
  });

  message +=
    "\n⚠️ Richiesta da confermare con il negozio.";

  return message;
}

/* ==========================================
   CONDIVISIONE ORDINE
========================================== */

async function copyMessage(message) {
  try {
    await navigator.clipboard.writeText(message);
    return true;

  } catch {
    const textarea = document.createElement("textarea");

    textarea.value = message;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);

    textarea.select();

    const copied = document.execCommand("copy");

    textarea.remove();

    return copied;
  }
}

async function sendOrder(channel) {
  if (!validateCheckout()) return;

  const message = buildOrderMessage();

  if (channel === "telegram") {
    const copied = await copyMessage(message);

    if (!copied) {
      showToast("Impossibile copiare il riepilogo");
      return;
    }

    const url = safeUrl(CONFIG.contacts.telegram);

    if (!url) {
      showToast("Configura il contatto Telegram");
      return;
    }

    showToast("Riepilogo copiato: incollalo nella chat");

    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  if (channel === "whatsapp") {
    const url = safeUrl(CONFIG.contacts.whatsapp);

    if (!url) {
      showToast("Configura il contatto WhatsApp");
      return;
    }

    const parsed = new URL(url);

    parsed.searchParams.set("text", message);

    window.open(
      parsed.href,
      "_blank",
      "noopener,noreferrer"
    );

    return;
  }

  if (channel === "signal") {
    const copied = await copyMessage(message);

    if (!copied) {
      showToast("Impossibile copiare il riepilogo");
      return;
    }

    showToast("Riepilogo copiato: incollalo su Signal");

    const url = safeUrl(CONFIG.contacts.signal);

    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
}

/* ==========================================
   RECENSIONI
========================================== */

function renderReviews() {
  const grid = $("reviewsGrid");
  const empty = $("reviewsEmpty");

  if (!grid || !empty) return;

  grid.innerHTML = "";

  empty.hidden = reviews.length > 0;

  reviews.forEach(review => {
    const card = document.createElement("article");

    card.className = "review-card";

    const mediaUrl = safeUrl(review.url);

    if (mediaUrl) {
      if (review.type === "video") {
        const video = document.createElement("video");

        video.src = mediaUrl;
        video.controls = true;
        video.playsInline = true;
        video.preload = "metadata";

        card.appendChild(video);

      } else {
        const image = document.createElement("img");

        image.src = mediaUrl;
        image.alt = "Recensione cliente";
        image.loading = "lazy";

        card.appendChild(image);
      }
    }

    const content = document.createElement("div");

    const rating = Math.max(
      0,
      Math.min(5, Number(review.rating) || 0)
    );

    content.innerHTML = `
      <div class="review-stars">
        ${"★".repeat(rating)}
        ${"☆".repeat(5 - rating)}
      </div>

      <p>${escapeHTML(review.text || "")}</p>
    `;

    card.appendChild(content);
    grid.appendChild(card);
  });
}

/* ==========================================
   CONTATTI
========================================== */

function setupContacts() {
  const links = {
    telegramContact: CONFIG.contacts.telegram,
    signalContact: CONFIG.contacts.signal,
    whatsappContact: CONFIG.contacts.whatsapp
  };

  Object.entries(links).forEach(([id, url]) => {
    const element = $(id);

    if (!element) return;

    const validated = safeUrl(url);

    if (validated) {
      element.href = validated;

    } else {
      element.removeAttribute("href");

      element.addEventListener("click", event => {
        event.preventDefault();

        showToast("Contatto non ancora configurato");
      });
    }
  });
}

/* ==========================================
   EVENTI PRINCIPALI
========================================== */

function setupEvents() {
  $("clearCartBtn")?.addEventListener("click", clearCart);

  $("orderTelegram")?.addEventListener("click", () => {
    sendOrder("telegram");
  });

  $("orderSignal")?.addEventListener("click", () => {
    sendOrder("signal");
  });

  $("orderWhatsapp")?.addEventListener("click", () => {
    sendOrder("whatsapp");
  });
}

/* ==========================================
   AVVIO APPLICAZIONE
========================================== */

async function initApp() {
  setupSplash();

  setupNavigation();
  setupFilters();
  setupDeliveryMethods();
  setupContacts();
  setupEvents();

  loadCart();

  await Promise.all([
    loadProducts(),
    loadReviews()
  ]);

  showPage("home");

  console.log(
    `${CONFIG.storeName} — Applicazione inizializzata`
  );
}

document.addEventListener(
  "DOMContentLoaded",
  initApp
);