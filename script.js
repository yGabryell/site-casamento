
/*
  CONFIGURAÇÃO EDITÁVEL
  Troque nomes, data, cidade, contato, links e imagens aqui.
  Observação: sem backend, status e compras pendentes ficam salvos apenas neste navegador.
*/
const CONFIG = {
  coupleNames: "Erica & Gabriel",
  weddingDate: "2027-05-01T16:00:00",
  city: "Chã do Pilar - AL",
  eventAddress: "Casa Berlins - Chã do Pilar",
  eventTime: "Recepção 16h | Cerimônia 17h",
  // Troque por um PIN seu para proteger o reset administrativo.
  adminPin: "EG01052027",
  whatsappPhone: "5582991008045",
  contactEmail: "gabriell.alvess399@gmail.com",
  pixKey: "5582991008045",
  pixTitular: "Erica & Gabriel",
  defaultLinks: {
    externalStore: "https://www.mercadolivre.com.br/",
    maps: "https://www.google.com/maps/search/?api=1&query=Casa+Berlins+Pilar+AL",
  },
  backend: {
    provider: "supabase", // "local" | "supabase"
    supabaseUrl: "https://bvbckfajmkfiajjymkmu.supabase.co",
    supabaseAnonKey: "sb_publishable_4tijqvw0v2NFeD6Lg8q_9w_wvDw6SyL",
    receiptsBucket: "wedding-receipts",
  },
  images: {
    hero: "assets/bg.jpg",
    photos: [
      "assets/photos/photo1.jpg",
      "assets/photos/photo2.jpg",
      "assets/photos/photo3.jpg",
      "assets/photos/photo4.jpg",
      "assets/photos/photo5.jpg",
    ],
  },
};

const GIFT_COLLECTIONS = {
  honeymoon: {
    label: "Lua de mel",
    intro: "Se quiserem fazer parte desse sonho, voces podem nos presentear com experiencias especiais para a nossa viagem.",
    emptyState: "Nenhuma experiencia de lua de mel disponivel no momento.",
  },
  registry: {
    label: "Lista de casamento virtual",
    intro: "Queridos familiares e amigos, para nos, a presenca de voces neste dia tao especial ja e o maior presente que poderiamos receber. Mas, se quiserem nos presentear nesta nova fase, ficaremos imensamente gratos por cada gesto de carinho e amor.",
    emptyState: "Nenhum presente disponivel no momento.",
  },
};

const GIFTS_PER_PAGE = 12;

const STORAGE_KEYS = {
  guestName: "wedding_guest_name",
  itemStatus: "wedding_item_status",
  adminUnlocked: "wedding_admin_unlocked",
  purchaseRequests: "wedding_purchase_requests",
  rsvpResponses: "wedding_rsvp_responses",
  guestMessages: "wedding_guest_messages",
};

const state = {
  items: [],
  purchaseRequests: [],
  rsvpResponses: [],
  guestMessages: [],
  currentSlide: 0,
  carouselIndex: 0,
  carouselTimer: null,
  carouselTouchStartX: 0,
  carouselTouchDeltaX: 0,
  activePage: "inicio",
  giftCategory: "honeymoon",
  giftPages: {
    honeymoon: 1,
    registry: 1,
  },
  giftMenuExpanded: false,
  searchTerm: "",
  priceRange: "all",
  touchStartX: 0,
  touchDeltaX: 0,
  toastTimer: null,
  countdownTimer: null,
  adminUnlocked: false,
  backend: null,
  backendMode: "local",
  adminSessionPin: "",
  activePurchaseItemId: null,
  purchaseSubmitBusy: false,
  rsvpSubmitBusy: false,
  messageSubmitBusy: false,
};

const memoryStorage = {
  local: Object.create(null),
  session: Object.create(null),
};

const el = {};

document.addEventListener("DOMContentLoaded", () => {
  void init();
});

async function init() {
  document.documentElement.classList.add("js-ready");
  try {
    cacheElements();
    await setupBackend();
    state.adminUnlocked = state.backendMode === "supabase"
      ? false
      : readFromStorage("session", STORAGE_KEYS.adminUnlocked) === "1";
    applyConfigToPage();
    await hydratePurchaseRequests();
    await hydrateRsvpResponses();
    await hydrateGuestMessages();
    await hydrateItems();
    if (reconcilePurchaseRequests()) {
      persistItemStatuses();
      persistPurchaseRequests();
    }
    setupPhotoCarousel();
    renderGiftList();
    renderGuestMessages();
    closePurchaseModal();
    bindEvents();
    startCountdown();
    setupRevealAnimations();
    checkMercadoPagoReturn();
  } catch (error) {
    handleInitError(error);
  }
}

function cacheElements() {
  el.coupleNames = document.getElementById("coupleNames");
  el.heroBrand = document.getElementById("heroBrand");
  el.menuOverlayBrand = document.getElementById("menuOverlayBrand");
  el.heroDate = document.getElementById("heroDate");
  el.heroCity = document.getElementById("heroCity");
  el.rsvpBtn = document.getElementById("rsvpBtn");
  el.topMenuToggle = document.getElementById("topMenuToggle");
  el.topMenuOverlay = document.getElementById("topMenuOverlay");
  el.topMenuClose = document.getElementById("topMenuClose");
  el.giftMenuToggle = document.getElementById("giftMenuToggle");
  el.giftMenuPanel = document.getElementById("giftMenuPanel");

  el.cdDays = document.getElementById("cdDays");
  el.cdHours = document.getElementById("cdHours");
  el.cdMinutes = document.getElementById("cdMinutes");
  el.cdSeconds = document.getElementById("cdSeconds");
  el.countdownMessage = document.getElementById("countdownMessage");

  el.photoStack = document.getElementById("photoStack");
  el.photoCarousel = document.getElementById("photoCarousel");
  el.carouselViewport = document.getElementById("carouselViewport");
  el.carouselTrack = document.getElementById("carouselTrack");
  el.carouselPrevBtn = document.getElementById("carouselPrevBtn");
  el.carouselNextBtn = document.getElementById("carouselNextBtn");
  el.carouselDots = document.getElementById("carouselDots");
  el.carouselCounter = document.getElementById("carouselCounter");

  el.photoLightbox = document.getElementById("photoLightbox");
  el.lightboxBackdrop = document.getElementById("lightboxBackdrop");
  el.lightboxImg = document.getElementById("lightboxImg");
  el.lightboxCloseBtn = document.getElementById("lightboxCloseBtn");
  el.lightboxCaption = document.getElementById("lightboxCaption");

  el.copyPixBtn = document.getElementById("copyPixBtn");
  el.pixKeyText = document.getElementById("pixKeyText");
  el.mpPixBtn = document.getElementById("mpPixBtn");
  el.mpPixBtnText = document.getElementById("mpPixBtnText");
  el.mpPixBtnSpinner = document.getElementById("mpPixBtnSpinner");
  el.mpCardBtn = document.getElementById("mpCardBtn") || document.getElementById("mpPayBtn");
  el.mpCardBtnText = document.getElementById("mpCardBtnText") || document.getElementById("mpPayBtnText");
  el.mpCardBtnSpinner = document.getElementById("mpCardBtnSpinner") || document.getElementById("mpPayBtnSpinner");
  el.mpPayBtn = el.mpCardBtn;
  el.mpPayBtnText = el.mpCardBtnText;
  el.mpPayBtnSpinner = el.mpCardBtnSpinner;

  el.searchInput = document.getElementById("searchInput");
  el.priceFilter = document.getElementById("priceFilter");
  el.giftCategoryTabs = Array.from(document.querySelectorAll("[data-gift-category-tab]"));
  el.giftCategoryLead = document.getElementById("giftCategoryLead");
  el.giftCategoryText = document.getElementById("giftCategoryText");
  el.giftList = document.getElementById("giftList");
  el.giftPagination = document.getElementById("giftPagination");
  el.giftEmptyState = document.getElementById("giftEmptyState");
  el.purchasedList = document.getElementById("purchasedList");
  el.purchasedSummary = document.getElementById("purchasedSummary");
  el.purchasedEmptyState = document.getElementById("purchasedEmptyState");

  el.eventAddress = document.getElementById("eventAddress");
  el.eventTime = document.getElementById("eventTime");
  el.mapLink = document.getElementById("mapLink");
  el.mapEmbed = document.getElementById("mapEmbed");
  el.mapPreviewLink = document.getElementById("mapPreviewLink");
  el.contactWhatsapp = document.getElementById("contactWhatsapp");
  el.contactEmail = document.getElementById("contactEmail");
  el.contactWhatsappLabel = document.getElementById("contactWhatsappLabel");
  el.contactEmailLabel = document.getElementById("contactEmailLabel");

  el.rsvpModal = document.getElementById("rsvpModal");
  el.closeRsvpBtn = document.getElementById("closeRsvpBtn");
  el.rsvpText = document.getElementById("rsvpText");
  el.rsvpFlow = document.getElementById("rsvpFlow");
  el.rsvpGuestName = document.getElementById("rsvpGuestName");
  el.rsvpAttendanceYes = document.getElementById("rsvpAttendanceYes");
  el.rsvpAttendanceNo = document.getElementById("rsvpAttendanceNo");
  el.rsvpFeedback = document.getElementById("rsvpFeedback");
  el.submitRsvpBtn = document.getElementById("submitRsvpBtn");
  el.rsvpSuccess = document.getElementById("rsvpSuccess");
  el.rsvpSuccessMessage = document.getElementById("rsvpSuccessMessage");
  el.rsvpSuccessHint = document.getElementById("rsvpSuccessHint");
  el.rsvpSuccessCloseBtn = document.getElementById("rsvpSuccessCloseBtn");

  el.messageGuestName = document.getElementById("messageGuestName");
  el.messageGuestEmail = document.getElementById("messageGuestEmail");
  el.messageText = document.getElementById("messageText");
  el.messageCharCount = document.getElementById("messageCharCount");
  el.messageFeedback = document.getElementById("messageFeedback");
  el.submitMessageBtn = document.getElementById("submitMessageBtn");
  el.messageFormFlow = document.getElementById("messageFormFlow");
  el.messageSuccess = document.getElementById("messageSuccess");
  el.messageSuccessMessage = document.getElementById("messageSuccessMessage");
  el.messageSuccessResetBtn = document.getElementById("messageSuccessResetBtn");
  el.messagesList = document.getElementById("messagesList");
  el.messagesEmptyState = document.getElementById("messagesEmptyState");

  el.purchaseModal = document.getElementById("purchaseModal");
  el.closeModalBtn = document.getElementById("closeModalBtn");
  el.modalTitle = document.getElementById("modalTitle");
  el.modalText = document.getElementById("modalText");
  el.purchaseGuestName = document.getElementById("purchaseGuestName");
  el.purchaseFlow = document.getElementById("purchaseFlow");
  el.purchaseFeedback = document.getElementById("purchaseFeedback");
  el.externalLink = document.getElementById("externalLink");
  el.submitReceiptBtn = document.getElementById("submitReceiptBtn");
  el.purchaseSuccess = document.getElementById("purchaseSuccess");
  el.purchaseSuccessMessage = document.getElementById("purchaseSuccessMessage");
  el.purchaseSuccessCloseBtn = document.getElementById("purchaseSuccessCloseBtn");

  el.openAdminBtn = document.getElementById("openAdminBtn");
  el.adminModal = document.getElementById("adminModal");
  el.closeAdminBtn = document.getElementById("closeAdminBtn");
  el.adminFeedback = document.getElementById("adminFeedback");
  el.adminPinInput = document.getElementById("adminPinInput");
  el.togglePinVisBtn = document.getElementById("togglePinVisBtn");
  el.unlockAdminBtn = document.getElementById("unlockAdminBtn");
  el.adminAuthBlock = document.getElementById("adminAuthBlock");
  el.adminActionsBlock = document.getElementById("adminActionsBlock");
  el.lockAdminBtn = document.getElementById("lockAdminBtn");
  el.adminStatusText = document.getElementById("adminStatusText");
  el.adminRequestSummary = document.getElementById("adminRequestSummary");
  el.adminRequestList = document.getElementById("adminRequestList");
  el.adminRsvpSummary = document.getElementById("adminRsvpSummary");
  el.downloadRsvpCsvBtn = document.getElementById("downloadRsvpCsvBtn");
  el.adminRsvpList = document.getElementById("adminRsvpList");

  el.navLinks = Array.from(document.querySelectorAll("[data-nav]"));
  el.pageViews = Array.from(document.querySelectorAll("[data-page]"));
  el.toast = document.getElementById("toast");
  el.faqQuestions = Array.from(document.querySelectorAll(".faq__question"));
}

async function setupBackend() {
  const backendConfig = CONFIG.backend || {};
  const shouldUseSupabase = backendConfig.provider === "supabase"
    && backendConfig.supabaseUrl
    && backendConfig.supabaseAnonKey;

  if (!shouldUseSupabase) {
    state.backend = null;
    state.backendMode = "local";
    return;
  }

  const backendModule = await import("./supabase-backend.js");
  state.backend = backendModule.createSupabaseBackend({
    url: backendConfig.supabaseUrl,
    anonKey: backendConfig.supabaseAnonKey,
    receiptsBucket: backendConfig.receiptsBucket || "wedding-receipts",
  });
  state.backendMode = "supabase";
}

function applyConfigToPage() {
  document.documentElement.style.setProperty("--hero-image", `url("${CONFIG.images.hero}")`);

  el.coupleNames.textContent = CONFIG.coupleNames;
  const brandLabel = buildCoupleInitials(CONFIG.coupleNames);
  if (el.heroBrand) {
    el.heroBrand.textContent = brandLabel;
  }
  if (el.menuOverlayBrand) {
    el.menuOverlayBrand.textContent = brandLabel;
  }
  el.heroDate.textContent = formatEventDate(CONFIG.weddingDate);
  el.heroCity.textContent = CONFIG.city;
  el.eventAddress.textContent = CONFIG.eventAddress;
  el.eventTime.textContent = CONFIG.eventTime;
  const mapsHref = CONFIG.defaultLinks.maps;
  const mapsEmbedUrl = buildMapsEmbedUrl();
  el.mapLink.href = mapsHref;
  if (el.mapPreviewLink) {
    el.mapPreviewLink.href = mapsHref;
  }
  if (el.mapEmbed) {
    el.mapEmbed.src = mapsEmbedUrl;
  }
  if (el.contactEmailLabel) {
    el.contactEmailLabel.textContent = CONFIG.contactEmail;
  } else {
    el.contactEmail.textContent = CONFIG.contactEmail;
  }
  el.contactEmail.href = `mailto:${CONFIG.contactEmail}`;
  el.contactWhatsapp.href = buildWhatsAppLink("Olá! Gostaria de tirar uma dúvida sobre o casamento.");
}

async function hydratePurchaseRequests() {
  if (state.backendMode === "supabase") {
    state.purchaseRequests = [];
    return;
  }

  const savedRequests = readJson(STORAGE_KEYS.purchaseRequests, []);
  state.purchaseRequests = Array.isArray(savedRequests)
    ? savedRequests.filter(isValidPurchaseRequest)
    : [];
}

async function hydrateRsvpResponses() {
  if (state.backendMode === "supabase") {
    state.rsvpResponses = [];
    return;
  }

  const savedResponses = readJson(STORAGE_KEYS.rsvpResponses, []);
  state.rsvpResponses = Array.isArray(savedResponses)
    ? savedResponses.filter(isValidRsvpResponse).map(normalizeLocalRsvpResponse)
    : [];
}

async function hydrateGuestMessages() {
  if (state.backendMode === "supabase") {
    state.guestMessages = [];
    return;
  }

  const savedMessages = readJson(STORAGE_KEYS.guestMessages, []);
  state.guestMessages = Array.isArray(savedMessages)
    ? savedMessages.filter(isValidGuestMessage).map(normalizeGuestMessage)
    : [];
}

async function hydrateItems() {
  const sourceItems = Array.isArray(window.WEDDING_ITEMS) ? window.WEDDING_ITEMS : [];
  const savedStatus = state.backendMode === "supabase"
    ? await state.backend.loadGiftStates()
    : readJson(STORAGE_KEYS.itemStatus, {});

  state.items = sourceItems.map((item) => {
    const persisted = savedStatus[item.id] || {};
    return {
      ...item,
      category: normalizeGiftCategory(item.category),
      links: { ...(item.links || {}) },
      status: normalizeStatus(persisted.status || item.status),
      reservedBy: persisted.reservedBy || item.reservedBy || "",
    };
  });
}

function reconcilePurchaseRequests() {
  if (state.backendMode === "supabase") return false;

  let changed = false;
  const itemMap = new Map(state.items.map((item) => [String(item.id), item]));

  state.purchaseRequests = state.purchaseRequests.filter((request) => {
    const item = itemMap.get(String(request.itemId));
    const keep = Boolean(item) && item.status !== "purchased";
    if (!keep) changed = true;
    return keep;
  });

  const pendingByItemId = new Map(state.purchaseRequests.map((request) => [String(request.itemId), request]));

  state.items.forEach((item) => {
    const pendingRequest = pendingByItemId.get(String(item.id));
    if (pendingRequest) {
      if (item.status !== "pending" || item.reservedBy !== pendingRequest.guestName) {
        item.status = "pending";
        item.reservedBy = pendingRequest.guestName || "Convidado";
        changed = true;
      }
      return;
    }

    if (item.status === "pending") {
      item.status = "available";
      item.reservedBy = "";
      changed = true;
    }
  });

  return changed;
}
function setupPhotoCarousel() {
  const photos = Array.isArray(CONFIG.images.photos) && CONFIG.images.photos.length
    ? CONFIG.images.photos
    : ["assets/photos/photo1.jpg"];

  // Renderiza fallback caso el.photoStack exista
  if (el.photoStack) {
    el.photoStack.innerHTML = photos
      .slice(0, 5)
      .map(
        (path, index) => `
          <figure class="photo-stack__item">
            <img src="${path}" alt="Foto ${index + 1} do casal" loading="lazy" decoding="async">
          </figure>
        `
      )
      .join("");
  }

  if (!el.carouselTrack) return;

  // Renderiza os slides do carrossel
  el.carouselTrack.innerHTML = photos
    .map(
      (path, index) => `
        <div class="carousel__slide" data-slide-index="${index}" role="group" aria-roledescription="slide" aria-label="${index + 1} de ${photos.length}">
          <figure class="carousel__figure">
            <img src="${path}" alt="Foto ${index + 1} do ensaio pré-wedding de ${escapeHtml(CONFIG.coupleNames)}" loading="lazy" decoding="async" class="carousel__img">
            <div class="carousel__overlay-badge">
              <span>Pré-Wedding • Foto ${index + 1}</span>
            </div>
          </figure>
        </div>
      `
    )
    .join("");

  // Renderiza os dots indicadores
  if (el.carouselDots) {
    el.carouselDots.innerHTML = photos
      .map(
        (_, index) => `
          <button class="carousel__dot ${index === 0 ? "is-active" : ""}" type="button" data-dot-index="${index}" aria-label="Ir para foto ${index + 1}">
          </button>
        `
      )
      .join("");
  }

  state.carouselIndex = 0;
  updateCarouselUI();
  bindCarouselEvents(photos);
}

function updateCarouselUI() {
  const photos = Array.isArray(CONFIG.images.photos) ? CONFIG.images.photos : [];
  const total = photos.length || 1;
  const current = state.carouselIndex;

  if (el.carouselTrack) {
    el.carouselTrack.style.transform = `translateX(-${current * 100}%)`;
  }

  if (el.carouselCounter) {
    const formattedCurrent = String(current + 1).padStart(2, "0");
    const formattedTotal = String(total).padStart(2, "0");
    el.carouselCounter.textContent = `${formattedCurrent} / ${formattedTotal}`;
  }

  if (el.carouselDots) {
    const dots = el.carouselDots.querySelectorAll(".carousel__dot");
    dots.forEach((dot, idx) => {
      dot.classList.toggle("is-active", idx === current);
      dot.setAttribute("aria-current", idx === current ? "true" : "false");
    });
  }
}

function goToCarouselSlide(index) {
  const photos = Array.isArray(CONFIG.images.photos) ? CONFIG.images.photos : [];
  const total = photos.length;
  if (!total) return;

  state.carouselIndex = (index + total) % total;
  updateCarouselUI();
}

function bindCarouselEvents(photos) {
  if (el.carouselPrevBtn) {
    el.carouselPrevBtn.addEventListener("click", () => {
      goToCarouselSlide(state.carouselIndex - 1);
      restartCarouselAutoplay();
    });
  }

  if (el.carouselNextBtn) {
    el.carouselNextBtn.addEventListener("click", () => {
      goToCarouselSlide(state.carouselIndex + 1);
      restartCarouselAutoplay();
    });
  }

  if (el.carouselDots) {
    el.carouselDots.addEventListener("click", (e) => {
      const dot = e.target.closest("[data-dot-index]");
      if (!dot) return;
      const targetIndex = Number(dot.dataset.dotIndex);
      if (!Number.isNaN(targetIndex)) {
        goToCarouselSlide(targetIndex);
        restartCarouselAutoplay();
      }
    });
  }

  // Toque / clique na foto para abrir lightbox
  if (el.carouselTrack) {
    el.carouselTrack.addEventListener("click", (e) => {
      const slide = e.target.closest(".carousel__slide");
      if (!slide) return;
      const idx = Number(slide.dataset.slideIndex);
      openLightbox(idx);
    });

    // Gestos de toque (swipe no celular)
    el.carouselTrack.addEventListener(
      "touchstart",
      (e) => {
        state.carouselTouchStartX = e.touches[0].clientX;
        state.carouselTouchDeltaX = 0;
        pauseCarouselAutoplay();
      },
      { passive: true }
    );

    el.carouselTrack.addEventListener(
      "touchmove",
      (e) => {
        state.carouselTouchDeltaX = e.touches[0].clientX - state.carouselTouchStartX;
      },
      { passive: true }
    );

    el.carouselTrack.addEventListener("touchend", () => {
      if (state.carouselTouchDeltaX > 45) {
        goToCarouselSlide(state.carouselIndex - 1);
      } else if (state.carouselTouchDeltaX < -45) {
        goToCarouselSlide(state.carouselIndex + 1);
      }
      restartCarouselAutoplay();
    });
  }

  // Pausa autoplay quando o mouse estiver sobre o carrossel
  if (el.photoCarousel) {
    el.photoCarousel.addEventListener("mouseenter", pauseCarouselAutoplay);
    el.photoCarousel.addEventListener("mouseleave", startCarouselAutoplay);
  }

  // Fechamento do Lightbox
  if (el.lightboxCloseBtn) {
    el.lightboxCloseBtn.addEventListener("click", closeLightbox);
  }
  if (el.lightboxBackdrop) {
    el.lightboxBackdrop.addEventListener("click", closeLightbox);
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && el.photoLightbox && !el.photoLightbox.hidden) {
      closeLightbox();
    }
  });

  startCarouselAutoplay();
}

function startCarouselAutoplay() {
  if (state.carouselTimer) return;
  state.carouselTimer = window.setInterval(() => {
    goToCarouselSlide(state.carouselIndex + 1);
  }, 5000);
}

function pauseCarouselAutoplay() {
  if (state.carouselTimer) {
    window.clearInterval(state.carouselTimer);
    state.carouselTimer = null;
  }
}

function restartCarouselAutoplay() {
  pauseCarouselAutoplay();
  startCarouselAutoplay();
}

function openLightbox(index) {
  const photos = Array.isArray(CONFIG.images.photos) ? CONFIG.images.photos : [];
  if (!photos.length || !el.photoLightbox || !el.lightboxImg) return;
  const photoSrc = photos[index] || photos[0];
  el.lightboxImg.src = photoSrc;
  el.lightboxImg.alt = `Foto ${index + 1} do ensaio pré-wedding`;
  if (el.lightboxCaption) {
    el.lightboxCaption.textContent = `${CONFIG.coupleNames} • Ensaio Pré-Wedding (${index + 1} de ${photos.length})`;
  }
  el.photoLightbox.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  if (!el.photoLightbox) return;
  el.photoLightbox.hidden = true;
  document.body.style.overflow = "";
}

function setGiftMenuExpanded(expanded) {
  state.giftMenuExpanded = Boolean(expanded);

  if (el.giftMenuPanel) {
    el.giftMenuPanel.hidden = !state.giftMenuExpanded;
  }

  if (el.giftMenuToggle) {
    el.giftMenuToggle.setAttribute("aria-expanded", state.giftMenuExpanded ? "true" : "false");
  }
}

function setActiveGiftCategory(category, options = {}) {
  const nextCategory = normalizeGiftCategory(category);
  const shouldResetPage = options.resetPage !== false;

  state.giftCategory = nextCategory;
  if (shouldResetPage) {
    state.giftPages[nextCategory] = 1;
  }

  renderGiftList();
}

function renderGiftCategoryUI() {
  const activeCategory = normalizeGiftCategory(state.giftCategory);
  const collection = GIFT_COLLECTIONS[activeCategory] || GIFT_COLLECTIONS.registry;

  if (el.giftCategoryLead) {
    el.giftCategoryLead.textContent = collection.label;
  }

  if (el.giftCategoryText) {
    el.giftCategoryText.textContent = collection.intro;
  }

  if (el.giftEmptyState) {
    el.giftEmptyState.textContent = collection.emptyState;
  }

  (el.giftCategoryTabs || []).forEach((tab) => {
    const isActive = state.activePage === "presentes"
      && normalizeGiftCategory(tab.dataset.giftCategoryTab) === activeCategory;
    tab.classList.toggle("is-active", isActive);
    if (isActive) {
      tab.setAttribute("aria-current", "page");
    } else {
      tab.removeAttribute("aria-current");
    }
  });

  if (el.giftMenuToggle) {
    el.giftMenuToggle.classList.toggle("is-active", state.activePage === "presentes");
  }
}

function renderGiftPagination(totalPages, currentPage) {
  if (!el.giftPagination) return;

  if (totalPages <= 1) {
    el.giftPagination.hidden = true;
    el.giftPagination.innerHTML = "";
    return;
  }

  el.giftPagination.hidden = false;
  el.giftPagination.innerHTML = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    const isActive = page === currentPage;
    return `
      <button class="gift-pagination__btn ${isActive ? "is-active" : ""}" type="button" data-gift-page="${page}" aria-label="Ir para a página ${page}" ${isActive ? 'aria-current="page"' : ""}>
        ${page}
      </button>
    `;
  }).join("");
}

function renderGiftList() {
  const activeCategory = normalizeGiftCategory(state.giftCategory);
  renderGiftCategoryUI();

  const filteredItems = state.items.filter((item) => {
    if (normalizeGiftCategory(item.category) !== activeCategory) {
      return false;
    }
    const target = `${item.nome} ${item.descricao}`.toLowerCase();
    const matchSearch = target.includes(state.searchTerm);
    const matchPrice = priceMatchesRange(item.preco, state.priceRange);
    return matchSearch && matchPrice;
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / GIFTS_PER_PAGE));
  const currentPage = Math.min(Math.max(1, state.giftPages[activeCategory] || 1), totalPages);
  const pageStart = (currentPage - 1) * GIFTS_PER_PAGE;
  const paginatedItems = filteredItems.slice(pageStart, pageStart + GIFTS_PER_PAGE);
  state.giftPages[activeCategory] = currentPage;

  if (el.giftEmptyState) {
    el.giftEmptyState.hidden = filteredItems.length !== 0;
  }

  if (el.giftList) {
    el.giftList.innerHTML = paginatedItems
      .map((item) => {
        const buyDisabled = item.status === "pending" || item.status === "purchased" ? "disabled" : "";
        const buyText = item.status === "pending" ? "Aguardando" : item.status === "purchased" ? "Comprado" : "Presentear";
        const helperMarkup = itemStatusHelperMarkup(item);

        return `
          <article class="gift-card" data-id="${item.id}">
            <img class="gift-card__img" src="${item.imagem}" alt="${escapeHtml(item.nome)}" loading="lazy" decoding="async">
            <div class="gift-card__body">
              <div class="gift-card__head">
                <div>
                  <h3 class="gift-card__title">${escapeHtml(item.nome)}</h3>
                  <p class="gift-card__desc">${escapeHtml(item.descricao)}</p>
                </div>
                <span class="status-badge" data-status="${item.status}">${labelForStatus(item.status)}</span>
              </div>
              <p class="gift-card__price">${formatCurrency(item.preco)}</p>
              ${helperMarkup}
              <div class="gift-card__actions">
                <button class="btn btn--primary" type="button" data-buy-id="${item.id}" ${buyDisabled}>${buyText}</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  renderGiftPagination(totalPages, currentPage);

  renderPurchasedList();
  renderAdminRequestList();
  renderAdminRsvpList();
}

function renderPurchasedList() {
  if (!el.purchasedList || !el.purchasedEmptyState) return;

  const purchasedItems = state.items
    .filter((item) => item.status === "purchased")
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const purchasedTotal = purchasedItems.reduce((sum, item) => {
    const price = Number(item.preco);
    return Number.isFinite(price) ? sum + price : sum;
  }, 0);
  if (el.purchasedSummary) {
    const itemLabel = purchasedItems.length === 1 ? "item" : "itens";
    el.purchasedSummary.textContent = `Total arrecadado confirmado: ${formatCurrency(purchasedTotal)} (${purchasedItems.length} ${itemLabel}).`;
  }

  el.purchasedEmptyState.hidden = purchasedItems.length !== 0;

  el.purchasedList.innerHTML = purchasedItems
    .map((item) => {
      const buyerName = item.reservedBy ? escapeHtml(item.reservedBy) : "Não informado";
      const deleteAction = state.adminUnlocked
        ? `
          <div class="purchased-list__item-actions">
            <button class="btn btn--ghost" type="button" data-delete-purchased-item="${item.id}">Excluir</button>
          </div>
        `
        : "";
      return `
        <li class="purchased-list__item">
          <div>
            <div class="purchased-list__name">${escapeHtml(item.nome)}</div>
            <div class="purchased-list__meta">${formatCurrency(item.preco)}</div>
          </div>
          <span class="purchased-list__buyer">${buyerName}</span>
          ${deleteAction}
        </li>
      `;
    })
    .join("");
}

function renderAdminRequestList() {
  if (!el.adminRequestList || !el.adminRequestSummary) return;

  const pendingRequests = state.purchaseRequests
    .slice()
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  if (!pendingRequests.length) {
    el.adminRequestSummary.textContent = "Nenhuma compra aguardando validação.";
    el.adminRequestList.innerHTML = "";
    return;
  }

  el.adminRequestSummary.textContent = `${pendingRequests.length} compra(s) aguardando sua validação.`;
  el.adminRequestList.innerHTML = pendingRequests
    .map(
      (request) => `
        <article class="admin-request" data-request-id="${escapeHtml(request.id)}">
          <div class="admin-request__head">
            <div>
              <h4 class="admin-request__title">${escapeHtml(request.itemName)}</h4>
              <p class="admin-request__meta">${escapeHtml(request.guestName || "Convidado")} | ${formatDateTime(request.submittedAt)}</p>
            </div>
            <span class="status-badge" data-status="pending">Aguardando</span>
          </div>
          <div class="admin-request__actions">
            <button class="btn btn--primary" type="button" data-approve-request="${escapeHtml(request.id)}">Aprovar compra</button>
            <button class="btn btn--ghost" type="button" data-reject-request="${escapeHtml(request.id)}">Rejeitar</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAdminRsvpList() {
  if (!el.adminRsvpList || !el.adminRsvpSummary) return;

  const responses = state.rsvpResponses
    .slice()
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  if (el.downloadRsvpCsvBtn) {
    el.downloadRsvpCsvBtn.disabled = responses.length === 0;
  }

  if (!responses.length) {
    el.adminRsvpSummary.textContent = "Nenhuma confirmação registrada ainda.";
    el.adminRsvpList.innerHTML = "";
    return;
  }

  el.adminRsvpSummary.textContent = `${responses.length} confirmação(ões) registradas.`;
  el.adminRsvpList.innerHTML = responses
    .map((response) => {
      const attendanceChoice = normalizeRsvpAttendanceChoice(response.attendanceChoice);
      const attendanceLabel = attendanceChoice === "no" ? "Não" : "Sim";
      const attendanceStatus = attendanceChoice === "no" ? "declined" : "attending";
      return `
        <article class="admin-rsvp__item">
          <div class="admin-rsvp__head">
            <h5 class="admin-rsvp__guest">${escapeHtml(response.guestName)}</h5>
            <span class="status-badge" data-status="${attendanceStatus}">${attendanceLabel}</span>
          </div>
          <p class="admin-rsvp__meta">Vai ao evento: ${attendanceLabel}</p>
          <p class="admin-rsvp__meta">Enviado em ${formatDateTime(response.submittedAt)}</p>
          <div class="admin-rsvp__item-actions">
            <button class="btn btn--ghost" type="button" data-delete-rsvp="${escapeHtml(response.id)}">Excluir</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderGuestMessages() {
  if (!el.messagesList || !el.messagesEmptyState) return;

  const messages = state.guestMessages
    .slice()
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  el.messagesEmptyState.hidden = messages.length !== 0;
  if (!messages.length) {
    el.messagesList.innerHTML = "";
    return;
  }

  el.messagesList.innerHTML = messages
    .map((message) => {
      const guestName = escapeHtml(message.guestName || "Convidado");
      const guestEmail = message.guestEmail ? ` | ${escapeHtml(message.guestEmail)}` : "";
      return `
        <article class="mensagem-card">
          <span class="mensagem-card__quote" aria-hidden="true">&ldquo;</span>
          <p class="mensagem-card__text">${escapeHtml(message.messageText)}</p>
          <p class="mensagem-card__meta">${guestName}${guestEmail} - ${formatDateTime(message.submittedAt)}</p>
          <div class="mensagem-card__actions">
            <button class="btn btn--ghost" type="button" data-delete-message="${escapeHtml(message.id)}">Excluir</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function downloadRsvpCsv() {
  if (!state.rsvpResponses.length) {
    showToast("Não há confirmações para exportar");
    return;
  }

  const rows = [
    ["Nome do convidado", "Vai ao evento?", "Enviado em"],
    ...state.rsvpResponses
      .slice()
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      .map((response) => [
        response.guestName || "",
        normalizeRsvpAttendanceChoice(response.attendanceChoice) === "no" ? "Não" : "Sim",
        formatDateTime(response.submittedAt),
      ]),
  ];

  const csvContent = rows
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, "\"\"")}"`).join(";"))
    .join("\r\n");

  const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeDate = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `confirmacoes-casamento-${safeDate}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast("CSV das confirmações baixado");
}

async function refreshPendingRequests() {
  if (state.backendMode !== "supabase") return;
  if (!state.adminUnlocked || !state.adminSessionPin) {
    state.purchaseRequests = [];
    return;
  }

  state.purchaseRequests = await state.backend.listPendingRequests(state.adminSessionPin);
}

async function refreshRsvpResponses() {
  if (state.backendMode !== "supabase") return;
  if (!state.adminUnlocked || !state.adminSessionPin) {
    state.rsvpResponses = [];
    return;
  }

  state.rsvpResponses = await state.backend.listRsvpResponses(state.adminSessionPin);
}

async function refreshGuestMessages() {
  if (state.backendMode !== "supabase") return;
  if (!state.adminUnlocked || !state.adminSessionPin) {
    state.guestMessages = [];
    return;
  }

  state.guestMessages = await state.backend.listGuestMessages(state.adminSessionPin);
}

async function deleteRsvpResponse(responseId) {
  if (!state.adminUnlocked) {
    showToast("Desbloqueie o painel administrativo primeiro");
    return;
  }

  const response = state.rsvpResponses.find((entry) => entry.id === responseId);
  if (!response) return;

  const guestLabel = response.guestName || "este convidado";
  const confirmed = window.confirm(`Excluir a confirmação de presença de ${guestLabel}?`);
  if (!confirmed) return;

  if (state.backendMode === "supabase") {
    try {
      await state.backend.deleteRsvpResponse(responseId, state.adminSessionPin);
      await refreshRsvpResponses();
      renderAdminRsvpList();
      el.adminFeedback.textContent = "Confirmação de presença excluída com sucesso.";
      showToast("Confirmação excluída");
    } catch (error) {
      const message = isMissingRsvpDeleteFunctionError(error)
        ? "A exclusão ainda não foi ativada no Supabase. Rode a migration do RSVP novamente."
        : formatErrorMessage(error, "Não foi possível excluir a confirmação de presença.");
      el.adminFeedback.textContent = message;
      showToast("Falha ao excluir confirmação");
    }
    return;
  }

  state.rsvpResponses = state.rsvpResponses.filter((entry) => entry.id !== responseId);
  persistRsvpResponses();
  renderAdminRsvpList();
  el.adminFeedback.textContent = "Confirmação de presença excluída com sucesso.";
  showToast("Confirmação excluída");
}

async function deleteGuestMessage(messageId) {
  if (!state.adminUnlocked) {
    showToast("Desbloqueie o painel administrativo primeiro");
    return;
  }

  const message = state.guestMessages.find((entry) => entry.id === messageId);
  if (!message) return;

  const guestLabel = message.guestName || "este convidado";
  const confirmed = window.confirm(`Excluir a mensagem enviada por ${guestLabel}?`);
  if (!confirmed) return;

  if (state.backendMode === "supabase") {
    try {
      await state.backend.deleteGuestMessage(messageId, state.adminSessionPin);
      await refreshGuestMessages();
      renderGuestMessages();
      el.adminFeedback.textContent = "Mensagem excluída com sucesso.";
      showToast("Mensagem excluída");
    } catch (error) {
      const normalizedMessage = isMissingGuestMessageDeleteFunctionError(error)
        ? "A exclusão de mensagens ainda não foi ativada no Supabase. Rode a nova migration de mensagens."
        : formatErrorMessage(error, "Não foi possível excluir a mensagem.");
      el.adminFeedback.textContent = normalizedMessage;
      showToast("Falha ao excluir mensagem");
    }
    return;
  }

  state.guestMessages = state.guestMessages.filter((entry) => entry.id !== messageId);
  persistGuestMessages();
  renderGuestMessages();
  el.adminFeedback.textContent = "Mensagem excluída com sucesso.";
  showToast("Mensagem excluída");
}

async function deletePurchasedItem(itemId) {
  if (!state.adminUnlocked) {
    showToast("Desbloqueie o painel administrativo primeiro");
    return;
  }

  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) return;

  const itemLabel = item.nome || "este item";
  const confirmed = window.confirm(`Excluir ${itemLabel} da lista de compras e liberar novamente?`);
  if (!confirmed) return;

  if (state.backendMode === "supabase") {
    try {
      await state.backend.deletePurchaseItem(item.id, state.adminSessionPin);
      await hydrateItems();
      await refreshPendingRequests();
      renderGiftList();
      el.adminFeedback.textContent = `${itemLabel} excluído com sucesso e liberado novamente.`;
      showToast("Item excluído com sucesso");
    } catch (error) {
      const message = isMissingPurchaseDeleteFunctionError(error)
        ? "A exclusão de item ainda não foi ativada no Supabase. Rode o setup.sql novamente."
        : formatErrorMessage(error, "Não foi possível excluir este item.");
      el.adminFeedback.textContent = message;
      showToast("Falha ao excluir item");
    }
    return;
  }

  state.purchaseRequests = state.purchaseRequests.filter((entry) => entry.itemId !== item.id);
  item.status = "available";
  item.reservedBy = "";
  persistPurchaseRequests();
  persistItemStatuses();
  renderGiftList();
  el.adminFeedback.textContent = `${itemLabel} excluído com sucesso e liberado novamente.`;
  showToast("Item excluído com sucesso");
}

function bindEvents() {
  bindAnchorScroll();
  bindTopMenuEvents();
  bindRsvpEvents();
  bindMessageEvents();
  bindGiftEvents();
  bindPixEvents();
  bindPurchaseEvents();
  bindAdminEvents();
  bindFaqEvents();

  if (el.searchInput) {
    el.searchInput.addEventListener("input", (event) => {
      state.searchTerm = event.target.value.trim().toLowerCase();
      state.giftPages[state.giftCategory] = 1;
      renderGiftList();
    });
  }

  if (el.priceFilter) {
    el.priceFilter.addEventListener("change", (event) => {
      state.priceRange = event.target.value;
      state.giftPages[state.giftCategory] = 1;
      renderGiftList();
    });
  }
}

function bindAnchorScroll() {
  el.navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetHash = link.getAttribute("href");
      if (!targetHash || !targetHash.startsWith("#")) return;
      event.preventDefault();

      const nextCategory = link.dataset.giftCategoryTab;
      if (nextCategory) {
        setActiveGiftCategory(nextCategory, { resetPage: true });
        setGiftMenuExpanded(true);
      } else if (resolvePageTarget(targetHash) !== "presentes") {
        setGiftMenuExpanded(false);
      }

      showPage(resolvePageTarget(targetHash), { updateHash: true, resetScroll: true });
    });
  });

  window.addEventListener("hashchange", () => {
    showPage(resolvePageTarget(window.location.hash), {
      updateHash: true,
      replaceHash: true,
      resetScroll: true,
    });
  });

  showPage(resolvePageTarget(window.location.hash), {
    updateHash: true,
    replaceHash: true,
    resetScroll: false,
  });
}

function bindTopMenuEvents() {
  if (!el.topMenuToggle || !el.topMenuOverlay) return;

  const closeMenu = () => {
    el.topMenuOverlay.hidden = true;
    el.topMenuToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("modal-open");
  };

  const openMenu = () => {
    el.topMenuOverlay.hidden = false;
    el.topMenuToggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("modal-open");
    setGiftMenuExpanded(state.activePage === "presentes" || state.giftMenuExpanded);
  };

  el.topMenuToggle.addEventListener("click", () => {
    if (el.topMenuOverlay.hidden) {
      openMenu();
    } else {
      closeMenu();
    }
  });

  if (el.topMenuClose) {
    el.topMenuClose.addEventListener("click", closeMenu);
  }

  el.topMenuOverlay.addEventListener("click", (event) => {
    if (event.target === el.topMenuOverlay || event.target.id === "topMenuBackdrop") {
      closeMenu();
    }
  });

  if (el.giftMenuToggle) {
    el.giftMenuToggle.addEventListener("click", () => {
      setGiftMenuExpanded(!state.giftMenuExpanded);
    });
  }

  el.navLinks.forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !el.topMenuOverlay.hidden) {
      closeMenu();
    }
  });
}

function bindRsvpEvents() {
  if (el.rsvpGuestName) {
    el.rsvpGuestName.addEventListener("input", () => {
      setRsvpFeedback("");
    });
  }

  [el.rsvpAttendanceYes, el.rsvpAttendanceNo]
    .filter(Boolean)
    .forEach((input) => {
      input.addEventListener("change", () => {
        setRsvpFeedback("");
      });
    });

  if (el.submitRsvpBtn) {
    el.submitRsvpBtn.addEventListener("click", () => {
      void handleRsvpSubmission();
    });
  }

  if (el.rsvpSuccessCloseBtn) {
    el.rsvpSuccessCloseBtn.addEventListener("click", closeRsvpModal);
  }
}

function bindMessageEvents() {
  if (el.messageText) {
    el.messageText.addEventListener("input", () => {
      updateMessageCharCount();
      setMessageFeedback("");
    });
  }

  if (el.messageGuestName) {
    el.messageGuestName.addEventListener("input", () => setMessageFeedback(""));
  }

  if (el.messageGuestEmail) {
    el.messageGuestEmail.addEventListener("input", () => setMessageFeedback(""));
  }

  if (el.submitMessageBtn) {
    el.submitMessageBtn.addEventListener("click", () => {
      void handleMessageSubmission();
    });
  }

  if (el.messageSuccessResetBtn) {
    el.messageSuccessResetBtn.addEventListener("click", () => {
      resetMessageForm(false);
      if (el.messageText) {
        el.messageText.focus();
      }
    });
  }

  if (el.messageGuestName && !el.messageGuestName.value) {
    el.messageGuestName.value = readStoredGuestName();
  }

  resetMessageForm(false);
  updateMessageCharCount();
  updateMessageSubmitState();
}

function bindPixEvents() {
  if (!el.copyPixBtn) return;
  el.copyPixBtn.addEventListener("click", async () => {
    const key = CONFIG.pixKey || "5582991008045";
    try {
      await navigator.clipboard.writeText(key);
      showToast("Chave Pix copiada com sucesso!");
      const originalHtml = el.copyPixBtn.innerHTML;
      el.copyPixBtn.textContent = "Chave copiada!";
      window.setTimeout(() => {
        el.copyPixBtn.innerHTML = originalHtml;
      }, 2500);
    } catch (err) {
      showToast(`Chave Pix: ${key}`);
    }
  });
}

function bindGiftEvents() {
  // Abas de presentes diretamente na página
  (el.giftCategoryTabs || []).forEach((tab) => {
    tab.addEventListener("click", () => {
      const category = tab.dataset.giftCategoryTab;
      if (category) {
        setActiveGiftCategory(category, { resetPage: true });
        renderGiftCategoryUI();
      }
    });
  });

  if (el.giftList) {
    el.giftList.addEventListener("click", (event) => {
      const buyBtn = event.target.closest("[data-buy-id]");
      if (buyBtn && !buyBtn.disabled) {
        void openPurchaseModal(Number(buyBtn.dataset.buyId));
      }
    });
  }

  if (el.giftPagination) {
    el.giftPagination.addEventListener("click", (event) => {
      const pageBtn = event.target.closest("[data-gift-page]");
      if (!pageBtn) return;
      const nextPage = Number(pageBtn.dataset.giftPage);
      if (!Number.isFinite(nextPage)) return;
      state.giftPages[state.giftCategory] = nextPage;
      renderGiftList();
      if (el.giftList) {
        el.giftList.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }
}

function bindPurchaseEvents() {
  if (el.mpPixBtn) {
    el.mpPixBtn.addEventListener("click", () => handleMercadoPagoCheckout("pix"));
  }

  if (el.mpCardBtn) {
    el.mpCardBtn.addEventListener("click", () => handleMercadoPagoCheckout("credit_card"));
  } else if (el.mpPayBtn) {
    el.mpPayBtn.addEventListener("click", () => handleMercadoPagoCheckout("credit_card"));
  }

  if (el.submitReceiptBtn) {
    el.submitReceiptBtn.addEventListener("click", handlePurchaseSubmission);
  }

  if (el.purchaseSuccessCloseBtn) {
    el.purchaseSuccessCloseBtn.addEventListener("click", closePurchaseModal);
  }

  if (el.externalLink) {
    el.externalLink.addEventListener("click", () => {
      setPurchaseFeedback("Depois do pagamento, volte aqui e confirme a compra.");
      showToast("Finalize o pagamento e confirme a compra");
    });
  }
}

function openRsvpModal() {
  showPage("confirmacao", { updateHash: true, resetScroll: true });
  if (el.rsvpGuestName) {
    window.setTimeout(() => el.rsvpGuestName.focus(), 200);
  }
}

function closeRsvpModal() {
  resetRsvpForm(false);
}

function resetRsvpForm(clearName) {
  state.rsvpSubmitBusy = false;
  updateRsvpSubmitState();
  setRsvpFeedback("");
  if (el.rsvpFlow) {
    el.rsvpFlow.hidden = false;
  }
  if (el.rsvpSuccess) {
    el.rsvpSuccess.hidden = true;
  }
  if (el.rsvpSuccessMessage) {
    el.rsvpSuccessMessage.textContent = "";
  }
  if (el.rsvpSuccessHint) {
    el.rsvpSuccessHint.textContent = "";
  }
  setSelectedRsvpAttendance("");
  if (clearName && el.rsvpGuestName) {
    el.rsvpGuestName.value = "";
  }
}

async function handleRsvpSubmission() {
  if (state.rsvpSubmitBusy) return;

  const guestName = el.rsvpGuestName ? el.rsvpGuestName.value.trim().slice(0, 60) : "";
  const attendanceChoice = getSelectedRsvpAttendance();
  if (!guestName) {
    setRsvpFeedback("Informe o nome do convidado para enviar a resposta.", true);
    return;
  }
  if (!attendanceChoice) {
    setRsvpFeedback("Selecione se você irá ao evento (Sim ou Não).", true);
    return;
  }

  try {
    state.rsvpSubmitBusy = true;
    updateRsvpSubmitState();
    setRsvpFeedback("Registrando sua confirmação...");

    persistGuestNameValue(guestName);

    if (state.backendMode === "supabase") {
      await state.backend.submitRsvpResponse(guestName, attendanceChoice);
      if (state.adminUnlocked && state.adminSessionPin) {
        await refreshRsvpResponses();
      }
    } else {
      const response = {
        id: createRequestId(),
        guestName,
        attendanceChoice,
        submittedAt: new Date().toISOString(),
      };
      state.rsvpResponses.unshift(response);
      persistRsvpResponses();
    }

    renderAdminRsvpList();
    showRsvpSuccess(guestName, attendanceChoice);
    showToast("Resposta registrada com sucesso");
  } catch (error) {
    const message = error && error.message ? error.message : "Não foi possível registrar sua confirmação agora.";
    setRsvpFeedback(message, true);
  } finally {
    state.rsvpSubmitBusy = false;
    updateRsvpSubmitState();
  }
}

function updateRsvpSubmitState() {
  if (!el.submitRsvpBtn) return;
  el.submitRsvpBtn.disabled = state.rsvpSubmitBusy;
  el.submitRsvpBtn.textContent = state.rsvpSubmitBusy ? "Enviando resposta..." : "Enviar resposta";
}

function setRsvpFeedback(message, isError) {
  if (!el.rsvpFeedback) return;
  el.rsvpFeedback.textContent = message || "";
  el.rsvpFeedback.dataset.state = isError ? "error" : "info";
}

function getSelectedRsvpAttendance() {
  if (el.rsvpAttendanceYes && el.rsvpAttendanceYes.checked) return "yes";
  if (el.rsvpAttendanceNo && el.rsvpAttendanceNo.checked) return "no";
  return "";
}

function setSelectedRsvpAttendance(value) {
  if (el.rsvpAttendanceYes) {
    el.rsvpAttendanceYes.checked = value === "yes";
  }
  if (el.rsvpAttendanceNo) {
    el.rsvpAttendanceNo.checked = value === "no";
  }
}

function showRsvpSuccess(guestName, attendanceChoice) {
  const weddingDate = formatEventDate(CONFIG.weddingDate);
  const normalizedAttendance = normalizeRsvpAttendanceChoice(attendanceChoice);

  if (el.rsvpFlow) {
    el.rsvpFlow.hidden = true;
  }
  if (el.rsvpSuccessMessage) {
    if (normalizedAttendance === "no") {
      el.rsvpSuccessMessage.textContent = `${guestName}, recebemos sua resposta. Vamos sentir sua falta no dia ${weddingDate}.`;
    } else {
      el.rsvpSuccessMessage.textContent = `${guestName}, muito obrigado por confirmar sua presença. Esperamos você no dia ${weddingDate}.`;
    }
  }
  if (el.rsvpSuccessHint) {
    if (normalizedAttendance === "no") {
      el.rsvpSuccessHint.textContent = "Se sua disponibilidade mudar, fale com os noivos para atualizar.";
    } else {
      el.rsvpSuccessHint.textContent = "Se precisar ajustar sua confirmação, fale com os noivos.";
    }
  }
  if (el.rsvpSuccess) {
    el.rsvpSuccess.hidden = false;
  }
  requestAnimationFrame(() => {
    if (el.rsvpSuccessCloseBtn) {
      el.rsvpSuccessCloseBtn.focus();
    }
  });
}

function resetMessageForm(clearName) {
  state.messageSubmitBusy = false;
  updateMessageSubmitState();
  setMessageFeedback("");
  if (el.messageFormFlow) {
    el.messageFormFlow.hidden = false;
  }
  if (el.messageSuccess) {
    el.messageSuccess.hidden = true;
  }
  if (el.messageSuccessMessage) {
    el.messageSuccessMessage.textContent = "";
  }
  if (clearName && el.messageGuestName) {
    el.messageGuestName.value = "";
  }
}

function showMessageSuccess(guestName) {
  if (el.messageFormFlow) {
    el.messageFormFlow.hidden = true;
  }
  if (el.messageSuccessMessage) {
    el.messageSuccessMessage.textContent = `${guestName}, muito obrigado por deixar suas palavras para nós. Sua mensagem já foi recebida com carinho.`;
  }
  if (el.messageSuccess) {
    el.messageSuccess.hidden = false;
  }
  requestAnimationFrame(() => {
    if (el.messageSuccessResetBtn) {
      el.messageSuccessResetBtn.focus();
    }
  });
}

async function handleMessageSubmission() {
  if (state.messageSubmitBusy) return;
  if (!el.messageGuestName || !el.messageText) return;

  const guestName = el.messageGuestName.value.trim().slice(0, 80);
  const guestEmail = el.messageGuestEmail ? el.messageGuestEmail.value.trim().slice(0, 120) : "";
  const messageText = el.messageText.value.trim();

  if (!guestName) {
    setMessageFeedback("Informe seu nome para enviar a mensagem.", true);
    return;
  }

  if (!messageText || messageText.length < 3) {
    setMessageFeedback("Escreva uma mensagem com pelo menos 3 caracteres.", true);
    return;
  }

  if (guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    setMessageFeedback("Informe um e-mail válido ou deixe esse campo em branco.", true);
    return;
  }

  try {
    state.messageSubmitBusy = true;
    updateMessageSubmitState();
    setMessageFeedback("Enviando sua mensagem...");

    persistGuestNameValue(guestName);

    if (state.backendMode === "supabase" && state.backend && typeof state.backend.submitGuestMessage === "function") {
      await state.backend.submitGuestMessage(guestName, guestEmail, messageText);
      if (state.adminUnlocked && state.adminSessionPin) {
        await refreshGuestMessages();
      }
    } else {
      const nextMessage = {
        id: createRequestId(),
        guestName,
        guestEmail,
        messageText,
        submittedAt: new Date().toISOString(),
      };

      state.guestMessages.unshift(nextMessage);
      persistGuestMessages();
    }

    renderGuestMessages();
    showMessageSuccess(guestName);
    showToast("Mensagem enviada com sucesso");

    if (el.messageText) {
      el.messageText.value = "";
    }
    if (el.messageGuestEmail) {
      el.messageGuestEmail.value = "";
    }
    updateMessageCharCount();
  } catch (error) {
    const message = error && error.message ? error.message : "Não foi possível enviar sua mensagem agora.";
    setMessageFeedback(message, true);
  } finally {
    state.messageSubmitBusy = false;
    updateMessageSubmitState();
  }
}

function updateMessageSubmitState() {
  if (!el.submitMessageBtn) return;
  el.submitMessageBtn.disabled = state.messageSubmitBusy;
  el.submitMessageBtn.textContent = state.messageSubmitBusy ? "Enviando..." : "Enviar mensagem";
}

function setMessageFeedback(message, isError) {
  if (!el.messageFeedback) return;
  el.messageFeedback.textContent = message || "";
  el.messageFeedback.dataset.state = isError ? "error" : "info";
}

function updateMessageCharCount() {
  if (!el.messageText || !el.messageCharCount) return;
  const remaining = Math.max(0, 4000 - el.messageText.value.length);
  const label = remaining === 1 ? "caractere restante" : "caracteres restantes";
  el.messageCharCount.textContent = `${remaining} ${label}`;
}

function bindAdminEvents() {
  if (!el.adminPinInput || !el.unlockAdminBtn || !el.lockAdminBtn) return;

  el.unlockAdminBtn.addEventListener("click", () => {
    void unlockAdminPanel();
  });
  el.adminPinInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      void unlockAdminPanel();
    }
  });

  if (el.togglePinVisBtn) {
    el.togglePinVisBtn.addEventListener("click", () => {
      const isPassword = el.adminPinInput.type === "password";
      el.adminPinInput.type = isPassword ? "text" : "password";
      el.togglePinVisBtn.setAttribute("aria-label", isPassword ? "Ocultar PIN" : "Mostrar PIN");
      const eyeIcon = document.getElementById("eyeIcon");
      if (eyeIcon) {
        eyeIcon.innerHTML = isPassword
          ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>'
          : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
      }
    });
  }

  if (el.downloadRsvpCsvBtn) {
    el.downloadRsvpCsvBtn.addEventListener("click", downloadRsvpCsv);
  }
  el.lockAdminBtn.addEventListener("click", () => {
    state.adminSessionPin = "";
    state.purchaseRequests = [];
    state.rsvpResponses = [];
    state.guestMessages = [];
    setAdminUnlocked(false);
    el.adminFeedback.textContent = "Painel bloqueado.";
    renderAdminRequestList();
    renderAdminRsvpList();
    renderGuestMessages();
    showToast("Painel administrativo bloqueado");
  });

  if (el.adminRequestList) {
    el.adminRequestList.addEventListener("click", (event) => {
      const approveBtn = event.target.closest("[data-approve-request]");
      if (approveBtn) {
        void approvePurchaseRequest(approveBtn.dataset.approveRequest);
        return;
      }

      const rejectBtn = event.target.closest("[data-reject-request]");
      if (rejectBtn) {
        void rejectPurchaseRequest(rejectBtn.dataset.rejectRequest);
      }
    });
  }

  if (el.adminRsvpList) {
    el.adminRsvpList.addEventListener("click", (event) => {
      const deleteBtn = event.target.closest("[data-delete-rsvp]");
      if (deleteBtn) {
        void deleteRsvpResponse(deleteBtn.dataset.deleteRsvp);
      }
    });
  }

  if (el.messagesList) {
    el.messagesList.addEventListener("click", (event) => {
      const deleteBtn = event.target.closest("[data-delete-message]");
      if (deleteBtn) {
        void deleteGuestMessage(deleteBtn.dataset.deleteMessage);
      }
    });
  }

  if (el.purchasedList) {
    el.purchasedList.addEventListener("click", (event) => {
      const deleteItemBtn = event.target.closest("[data-delete-purchased-item]");
      if (deleteItemBtn) {
        void deletePurchasedItem(Number(deleteItemBtn.dataset.deletePurchasedItem));
      }
    });
  }

  updateAdminPanelState();
  void openAdminModal();
}

function bindFaqEvents() {
  el.faqQuestions.forEach((button) => {
    button.addEventListener("click", () => {
      const answerId = button.getAttribute("aria-controls");
      const answer = document.getElementById(answerId);
      if (!answer) return;

      const shouldOpen = button.getAttribute("aria-expanded") !== "true";
      el.faqQuestions.forEach((item) => {
        const controlled = document.getElementById(item.getAttribute("aria-controls"));
        item.setAttribute("aria-expanded", "false");
        if (controlled) controlled.hidden = true;
      });

      if (shouldOpen) {
        button.setAttribute("aria-expanded", "true");
        answer.hidden = false;
      }
    });
  });
}

function openPurchaseModal(itemId) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) return;

  if (item.status === "purchased") {
    showToast("Este item já foi confirmado como comprado");
    return;
  }

  if (item.status === "pending") {
    showToast("Este item já está aguardando confirmação");
    return;
  }

  state.activePurchaseItemId = itemId;
  resetPurchaseForm(false, true);
  el.purchaseGuestName.value = readStoredGuestName();
  el.modalTitle.textContent = `Presentear: ${item.nome}`;
  el.modalText.hidden = false;
  el.modalText.textContent = `Escolha pagar via Mercado Pago (Pix automático ou Cartão em até 12x) ou faça o Pix direto com a chave dos noivos.`;
  if (el.mpPixBtnText) {
    el.mpPixBtnText.textContent = `Pagar no Pix via Mercado Pago (${formatCurrency(item.preco)})`;
  }
  if (el.mpCardBtnText) {
    el.mpCardBtnText.textContent = `Pagar no Cartão (${formatCurrency(item.preco)})`;
  } else if (el.mpPayBtnText) {
    el.mpPayBtnText.textContent = `Pagar no Cartão (${formatCurrency(item.preco)})`;
  }
  if (el.externalLink) {
    el.externalLink.href = item.links.external || CONFIG.defaultLinks.externalStore;
  }
  showPage("presentes", { updateHash: true, resetScroll: false });
  if (el.purchaseGuestName) {
    window.setTimeout(() => el.purchaseGuestName.focus(), 220);
  }
}

function closePurchaseModal() {
  state.activePurchaseItemId = null;
  resetPurchaseForm(true, false);
  setMpPayLoading(false);
  if (el.modalTitle) {
    el.modalTitle.textContent = "Presentear";
  }
  if (el.modalText) {
    el.modalText.textContent = "";
    el.modalText.hidden = true;
  }
}

function resetPurchaseForm(clearName, showFlow) {
  const shouldShowFlow = Boolean(showFlow);
  state.purchaseSubmitBusy = false;
  updatePurchaseSubmitState();
  setMpPayLoading(false);
  setPurchaseFeedback("");
  if (el.purchaseFlow) {
    el.purchaseFlow.hidden = !shouldShowFlow;
  }
  if (el.purchaseSuccess) {
    el.purchaseSuccess.hidden = true;
  }
  if (el.purchaseSuccessMessage) {
    el.purchaseSuccessMessage.textContent = "";
  }
  if (clearName && el.purchaseGuestName) {
    el.purchaseGuestName.value = "";
  }
}

function showPurchaseSuccess(itemName, guestName) {
  const namedGuest = guestName && guestName !== "Convidado" ? `${guestName}, ` : "";
  if (el.modalTitle) {
    el.modalTitle.textContent = "Tudo certo!";
  }
  if (el.modalText) {
    el.modalText.hidden = false;
    el.modalText.textContent = "Recebemos sua confirmação de compra com sucesso.";
  }
  if (el.purchaseFlow) {
    el.purchaseFlow.hidden = true;
  }
  if (el.purchaseSuccessMessage) {
    el.purchaseSuccessMessage.textContent = `${namedGuest}recebemos sua confirmação de compra do presente ${itemName}. Obrigado por fazer parte desse momento com a gente.`;
  }
  if (el.purchaseSuccess) {
    el.purchaseSuccess.hidden = false;
  }
  requestAnimationFrame(() => {
    if (el.purchaseSuccessCloseBtn) {
      el.purchaseSuccessCloseBtn.focus();
    }
  });
}

async function handlePurchaseSubmission() {
  if (state.purchaseSubmitBusy) return;

  const item = state.items.find((entry) => entry.id === state.activePurchaseItemId);
  if (!item) {
    setPurchaseFeedback("Não foi possível localizar o item selecionado.", true);
    return;
  }

  if (item.status === "pending" || item.status === "purchased") {
    setPurchaseFeedback("Este item não está mais disponível para confirmação.", true);
    renderGiftList();
    return;
  }

  const guestName = el.purchaseGuestName.value.trim();
  if (!guestName) {
    setPurchaseFeedback("Informe seu nome para confirmar a compra.", true);
    return;
  }

  try {
    state.purchaseSubmitBusy = true;
    updatePurchaseSubmitState();
    setPurchaseFeedback("Registrando confirmação...");

    persistGuestNameValue(guestName);

    if (state.backendMode === "supabase") {
      await state.backend.submitPurchaseRequest(item, guestName);
      await hydrateItems();
      await refreshPendingRequests();
    } else {
      const request = {
        id: createRequestId(),
        itemId: item.id,
        itemName: item.nome,
        guestName,
        submittedAt: new Date().toISOString(),
      };

      state.purchaseRequests = state.purchaseRequests.filter((entry) => entry.itemId !== item.id);
      state.purchaseRequests.unshift(request);
      item.status = "pending";
      item.reservedBy = guestName;

      persistPurchaseRequests();
      persistItemStatuses();
    }

    renderGiftList();

    showPurchaseSuccess(item.nome, guestName);
    showToast("Obrigado! Compra registrada com sucesso.");
  } catch (error) {
    const message = error && error.message ? error.message : "Não foi possível registrar a compra.";
    setPurchaseFeedback(message, true);
  } finally {
    state.purchaseSubmitBusy = false;
    updatePurchaseSubmitState();
  }
}
function updatePurchaseSubmitState() {
  if (!el.submitReceiptBtn) return;
  el.submitReceiptBtn.disabled = state.purchaseSubmitBusy;
  el.submitReceiptBtn.textContent = state.purchaseSubmitBusy ? "Confirmando..." : "Confirmar que enviei o Pix";
}

function setPurchaseFeedback(message, isError) {
  if (!el.purchaseFeedback) return;
  el.purchaseFeedback.textContent = message || "";
  el.purchaseFeedback.dataset.state = isError ? "error" : "info";
}

async function handleMercadoPagoCheckout(paymentMethod = "credit_card") {
  const item = state.items.find((entry) => entry.id === state.activePurchaseItemId);
  if (!item) {
    setPurchaseFeedback("Não foi possível localizar o item selecionado.", true);
    return;
  }

  if (item.status === "pending" || item.status === "purchased") {
    setPurchaseFeedback("Este item não está mais disponível para confirmação.", true);
    renderGiftList();
    return;
  }

  const guestName = (el.purchaseGuestName ? el.purchaseGuestName.value : "").trim();
  if (!guestName) {
    setPurchaseFeedback("Por favor, digite seu nome acima para identificar o presente.", true);
    if (el.purchaseGuestName) {
      el.purchaseGuestName.focus();
    }
    return;
  }

  persistGuestNameValue(guestName);

  setMpPayLoading(true, paymentMethod);
  setPurchaseFeedback("");

  try {
    const response = await fetch("/.netlify/functions/create-preference", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        itemId: item.id,
        itemName: item.nome,
        itemPrice: item.preco,
        itemImage: item.imagem,
        guestName,
        paymentMethod,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.error === "token_missing") {
        setPurchaseFeedback(
          "O pagamento via Mercado Pago está aguardando a configuração da chave MP_ACCESS_TOKEN no Netlify pelos noivos. Você pode presentear via Pix direto com 0% de taxas!",
          true
        );
      } else {
        setPurchaseFeedback(
          data.message || "Não foi possível gerar a tela de pagamento. Tente novamente ou use o Pix direto.",
          true
        );
      }
      setMpPayLoading(false);
      return;
    }

    if (data.init_point) {
      setPurchaseFeedback(
        paymentMethod === "pix"
          ? "Abrindo pagamento Pix seguro no Mercado Pago..."
          : "Redirecionando para o ambiente seguro do Mercado Pago..."
      );

      // Pré-registrar como pendente caso a conexão feche durante o checkout
      try {
        if (state.backendMode === "supabase") {
          await state.backend.submitPurchaseRequest(item, guestName);
        } else {
          const request = {
            id: createRequestId(),
            itemId: item.id,
            itemName: item.nome,
            guestName,
            submittedAt: new Date().toISOString(),
          };
          state.purchaseRequests = state.purchaseRequests.filter((entry) => entry.itemId !== item.id);
          state.purchaseRequests.unshift(request);
          item.status = "pending";
          item.reservedBy = guestName;
          persistPurchaseRequests();
          persistItemStatuses();
        }
      } catch (err) {
        console.warn("Erro ao pré-registrar:", err);
      }

      // Redireciona o convidado para o checkout oficial do Mercado Pago
      window.location.href = data.init_point;
    } else {
      throw new Error("Link de pagamento não retornado.");
    }
  } catch (err) {
    console.error("Erro ao chamar create-preference:", err);
    setPurchaseFeedback("Erro de conexão ao gerar o pagamento. Por favor, tente novamente ou use o Pix.", true);
    setMpPayLoading(false);
  }
}

function setMpPayLoading(loading, activeMethod = null) {
  const item = state.items.find((entry) => entry.id === state.activePurchaseItemId);
  const priceText = item ? ` (${formatCurrency(item.preco)})` : "";

  // Botão Pix Mercado Pago
  if (el.mpPixBtn) {
    el.mpPixBtn.disabled = loading;
    if (el.mpPixBtnSpinner) {
      el.mpPixBtnSpinner.hidden = !(loading && activeMethod === "pix");
    }
    if (el.mpPixBtnText) {
      el.mpPixBtnText.textContent =
        loading && activeMethod === "pix"
          ? "Gerando Pix Mercado Pago..."
          : `Pagar no Pix via Mercado Pago${priceText}`;
    }
  }

  // Botão Cartão Mercado Pago
  const cardBtn = el.mpCardBtn || el.mpPayBtn;
  const cardSpinner = el.mpCardBtnSpinner || el.mpPayBtnSpinner;
  const cardText = el.mpCardBtnText || el.mpPayBtnText;

  if (cardBtn) {
    cardBtn.disabled = loading;
    if (cardSpinner) {
      cardSpinner.hidden = !(loading && activeMethod === "credit_card");
    }
    if (cardText) {
      cardText.textContent =
        loading && activeMethod === "credit_card"
          ? "Gerando pagamento em até 12x..."
          : `Pagar no Cartão (em até 12x)${priceText}`;
    }
  }
}

function checkMercadoPagoReturn() {
  try {
    const url = new URL(window.location.href);
    const status = url.searchParams.get("status") || url.searchParams.get("collection_status");
    const itemIdParam = url.searchParams.get("item_id");
    const guestParam = url.searchParams.get("guest");

    if (!status) return;

    if (status === "approved") {
      const foundId = Number(itemIdParam);
      const item = state.items.find((entry) => entry.id === foundId);
      const guestName = guestParam || (item ? item.reservedBy : "Convidado");

      if (item) {
        item.status = "purchased";
        if (guestName) item.reservedBy = guestName;
        persistItemStatuses();
        renderGiftList();
      }

      showToast(`🎉 Pagamento aprovado! Muito obrigado pelo carinho${guestName ? ", " + guestName : ""}!`);

      if (el.purchaseSuccess) {
        showPage("presentes", { updateHash: true, resetScroll: false });
        showPurchaseSuccess(item ? item.nome : "Presente", guestName);
        if (el.purchaseSuccessMessage) {
          el.purchaseSuccessMessage.textContent = `Seu presente ${item ? `(${item.nome})` : ""} foi confirmado com sucesso pelo Mercado Pago! Erica e Gabriel agradecem de todo coração pelo gesto de amor.`;
        }
      }

      // Limpar parâmetros da URL de forma elegante
      window.history.replaceState({}, document.title, window.location.pathname + "#presentes");
    } else if (status === "pending") {
      showToast("Seu pagamento está sendo processado pelo Mercado Pago. Assim que compensar, os noivos serão notificados!");
      window.history.replaceState({}, document.title, window.location.pathname + "#presentes");
    } else if (status === "failure") {
      showToast("O pagamento no Mercado Pago não foi concluído. Você pode tentar novamente ou utilizar o Pix direto.");
      window.history.replaceState({}, document.title, window.location.pathname + "#presentes");
    }
  } catch (err) {
    console.warn("Erro ao processar retorno do Mercado Pago:", err);
  }
}

async function openAdminModal() {
  if (!el.adminFeedback) return;
  el.adminFeedback.textContent = "Somente para os noivos.";
  if (el.adminPinInput) {
    el.adminPinInput.value = "";
  }
  updateAdminPanelState();
  try {
    await refreshPendingRequests();
    await refreshRsvpResponses();
    await refreshGuestMessages();
  } catch (error) {
    el.adminFeedback.textContent = formatErrorMessage(error, "Não foi possível carregar os dados administrativos.");
  }
  renderAdminRequestList();
  renderAdminRsvpList();
  renderGuestMessages();
}

function closeAdminModal() {
  state.adminSessionPin = "";
  state.purchaseRequests = [];
  state.rsvpResponses = [];
  state.guestMessages = [];
  setAdminUnlocked(false);
  if (el.adminFeedback) {
    el.adminFeedback.textContent = "Painel bloqueado.";
  }
  renderAdminRequestList();
  renderAdminRsvpList();
  renderGuestMessages();
}

async function unlockAdminPanel() {
  if (!el.adminPinInput || !el.adminFeedback) return;
  const rawInput = el.adminPinInput.value.trim();
  if (!rawInput) {
    el.adminFeedback.textContent = "Digite o PIN administrativo.";
    showToast("Digite o PIN administrativo");
    return;
  }

  const upperInput = rawInput.toUpperCase();
  const configuredPin = String(CONFIG.adminPin || "").trim().toUpperCase();

  // Candidatos a PIN para permitir digitar tanto 01052027 quanto EG01052027
  const candidates = [upperInput];
  if (upperInput.startsWith("EG")) {
    candidates.push(upperInput.slice(2));
  } else {
    candidates.push(`EG${upperInput}`);
  }

  // Adicionar variações conhecidas da data do casamento
  if (upperInput.includes("01052027") || upperInput.includes("21112026")) {
    candidates.push("EG01052027", "01052027", "EG21112026", "21112026");
  }
  if (configuredPin) {
    candidates.push(configuredPin);
  }

  const uniqueCandidates = Array.from(new Set(candidates));

  try {
    let verifiedPin = null;
    if (state.backendMode === "supabase") {
      for (const pin of uniqueCandidates) {
        try {
          const isValid = await state.backend.verifyAdminPin(pin);
          if (isValid) {
            verifiedPin = pin;
            break;
          }
        } catch (_) {
          // Continua testando os outros candidatos
        }
      }

      if (!verifiedPin) {
        el.adminFeedback.textContent = "PIN inválido. Use 01052027 ou EG01052027.";
        showToast("PIN inválido");
        return;
      }
      state.adminSessionPin = verifiedPin;
    } else {
      const allowedPins = [configuredPin, "EG01052027", "01052027", "EG21112026", "21112026"].filter(Boolean);
      const match = uniqueCandidates.find((cand) => allowedPins.includes(cand));
      if (!match) {
        el.adminFeedback.textContent = "PIN inválido. Use 01052027 ou EG01052027.";
        showToast("PIN inválido");
        return;
      }
      state.adminSessionPin = match;
    }

    setAdminUnlocked(true);
    await refreshPendingRequests();
    await refreshRsvpResponses();
    await refreshGuestMessages();
    renderAdminRequestList();
    renderAdminRsvpList();
    renderGuestMessages();
    el.adminFeedback.textContent = "Painel liberado com sucesso.";
    el.adminPinInput.value = "";
    showToast("Painel administrativo liberado");
  } catch (error) {
    el.adminFeedback.textContent = formatErrorMessage(error, "Não foi possível validar o PIN.");
    showToast("Falha ao validar o PIN");
  }
}

function setAdminUnlocked(value) {
  state.adminUnlocked = Boolean(value);
  if (state.backendMode === "supabase") {
    if (!state.adminUnlocked) {
      state.adminSessionPin = "";
    }
    updateAdminPanelState();
    renderPurchasedList();
    return;
  }

  if (state.adminUnlocked) {
    writeToStorage("session", STORAGE_KEYS.adminUnlocked, "1");
  } else {
    removeFromStorage("session", STORAGE_KEYS.adminUnlocked);
  }
  updateAdminPanelState();
  renderPurchasedList();
}

function updateAdminPanelState() {
  if (!el.adminAuthBlock || !el.adminActionsBlock) return;
  el.adminAuthBlock.hidden = state.adminUnlocked;
  el.adminActionsBlock.hidden = !state.adminUnlocked;
  if (el.adminStatusText) {
    el.adminStatusText.textContent = state.adminUnlocked
      ? "Modo administrativo ativo neste navegador."
      : "Painel bloqueado.";
  }
}

async function approvePurchaseRequest(requestId) {
  if (!state.adminUnlocked) {
    showToast("Desbloqueie o painel administrativo primeiro");
    return;
  }

  if (state.backendMode === "supabase") {
    try {
      await state.backend.reviewPurchaseRequest(requestId, state.adminSessionPin, "approve");
      await hydrateItems();
      await refreshPendingRequests();
      renderGiftList();
      el.adminFeedback.textContent = "Compra confirmada com sucesso.";
      showToast("Compra confirmada");
    } catch (error) {
      el.adminFeedback.textContent = formatErrorMessage(error, "Não foi possível aprovar a compra.");
      showToast("Falha ao aprovar compra");
    }
    return;
  }

  const request = state.purchaseRequests.find((entry) => entry.id === requestId);
  if (!request) return;

  const item = state.items.find((entry) => entry.id === request.itemId);
  if (!item) {
    state.purchaseRequests = state.purchaseRequests.filter((entry) => entry.id !== requestId);
    persistPurchaseRequests();
    renderAdminRequestList();
    return;
  }

  item.status = "purchased";
  item.reservedBy = request.guestName || "Convidado";
  state.purchaseRequests = state.purchaseRequests.filter((entry) => entry.id !== requestId);

  persistPurchaseRequests();
  persistItemStatuses();
  renderGiftList();

  el.adminFeedback.textContent = `${item.nome} confirmado como comprado.`;
  showToast("Compra confirmada");
}

async function rejectPurchaseRequest(requestId) {
  if (!state.adminUnlocked) {
    showToast("Desbloqueie o painel administrativo primeiro");
    return;
  }

  if (state.backendMode === "supabase") {
    try {
      await state.backend.reviewPurchaseRequest(requestId, state.adminSessionPin, "reject");
      await hydrateItems();
      await refreshPendingRequests();
      renderGiftList();
      el.adminFeedback.textContent = "Compra rejeitada e item liberado novamente.";
      showToast("Compra rejeitada");
    } catch (error) {
      el.adminFeedback.textContent = formatErrorMessage(error, "Não foi possível rejeitar a compra.");
      showToast("Falha ao rejeitar compra");
    }
    return;
  }

  const request = state.purchaseRequests.find((entry) => entry.id === requestId);
  if (!request) return;

  const item = state.items.find((entry) => entry.id === request.itemId);
  if (item) {
    item.status = "available";
    item.reservedBy = "";
  }

  state.purchaseRequests = state.purchaseRequests.filter((entry) => entry.id !== requestId);
  persistPurchaseRequests();
  persistItemStatuses();
  renderGiftList();

  if (item) {
    el.adminFeedback.textContent = `Compra de ${item.nome} rejeitada e item liberado novamente.`;
  } else {
    el.adminFeedback.textContent = "Compra removida da fila.";
  }
  showToast("Compra rejeitada");
}

function clearPurchaseRequests() {
  state.purchaseRequests = [];
  if (state.backendMode === "supabase") return;
  persistPurchaseRequests();
}

function clearRsvpResponses() {
  state.rsvpResponses = [];
  if (state.backendMode === "supabase") return;
  persistRsvpResponses();
}

function setAllItemsAvailable() {
  state.items.forEach((item) => {
    item.status = "available";
    item.reservedBy = "";
  });
}

async function toggleReserve(itemId) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item || item.status === "purchased" || item.status === "pending") return;

  try {
    if (item.status === "reserved") {
      if (state.backendMode === "supabase") {
        await state.backend.setReservation(item.id, "", false);
        await hydrateItems();
      } else {
        item.status = "available";
        item.reservedBy = "";
        persistItemStatuses();
      }
      showToast("Reserva cancelada");
    } else {
      const guestName = readStoredGuestName() || requestGuestNameForReserve();
      if (!guestName) {
        showToast("Informe seu nome para reservar");
        return;
      }
      if (state.backendMode === "supabase") {
        persistGuestNameValue(guestName);
        await state.backend.setReservation(item.id, guestName, true);
        await hydrateItems();
      } else {
        item.status = "reserved";
        item.reservedBy = guestName;
        persistItemStatuses();
      }
      showToast("Item reservado");
    }

    renderGiftList();
  } catch (error) {
    showToast(formatErrorMessage(error, "Não foi possível atualizar a reserva."));
  }
}

function persistGuestNameValue(value) {
  writeToStorage("local", STORAGE_KEYS.guestName, value);
}

function readStoredGuestName() {
  return readFromStorage("local", STORAGE_KEYS.guestName) || "";
}

function requestGuestNameForReserve() {
  const typedName = window.prompt("Digite seu nome para identificar a reserva.");
  const normalizedName = typedName ? typedName.trim().slice(0, 40) : "";
  if (normalizedName) {
    persistGuestNameValue(normalizedName);
  }
  return normalizedName;
}

function persistItemStatuses() {
  if (state.backendMode === "supabase") return;

  const payload = {};
  state.items.forEach((item) => {
    payload[item.id] = {
      status: item.status,
      reservedBy: item.reservedBy || "",
    };
  });
  writeToStorage("local", STORAGE_KEYS.itemStatus, JSON.stringify(payload));
}

function persistPurchaseRequests() {
  if (state.backendMode === "supabase") return;
  writeToStorage("local", STORAGE_KEYS.purchaseRequests, JSON.stringify(state.purchaseRequests));
}

function persistRsvpResponses() {
  if (state.backendMode === "supabase") return;
  writeToStorage("local", STORAGE_KEYS.rsvpResponses, JSON.stringify(state.rsvpResponses));
}

function persistGuestMessages() {
  if (state.backendMode === "supabase") return;
  writeToStorage("local", STORAGE_KEYS.guestMessages, JSON.stringify(state.guestMessages));
}

function startCountdown() {
  updateCountdown();
  state.countdownTimer = window.setInterval(updateCountdown, 1000);
}

function updateCountdown() {
  const targetDate = new Date(CONFIG.weddingDate);
  const now = new Date();
  if (Number.isNaN(targetDate.getTime())) {
    if (el.countdownMessage) {
      el.countdownMessage.textContent = "Data inválida. Ajuste a data no CONFIG.";
    }
    return;
  }

  const diff = targetDate.getTime() - now.getTime();
  if (diff <= 0) {
    setCountdownValues(0, 0, 0, 0);
    if (el.countdownMessage) {
      el.countdownMessage.textContent = "Chegou o grande dia.";
    }
    if (state.countdownTimer) {
      window.clearInterval(state.countdownTimer);
      state.countdownTimer = null;
    }
    return;
  }

  const seconds = Math.floor(diff / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  setCountdownValues(days, hours, minutes, secs);
  if (el.countdownMessage) {
    el.countdownMessage.textContent = "Contagem regressiva para celebrar com você.";
  }
}

function setCountdownValues(days, hours, minutes, seconds) {
  el.cdDays.textContent = String(days);
  el.cdHours.textContent = String(hours).padStart(2, "0");
  el.cdMinutes.textContent = String(minutes).padStart(2, "0");
  el.cdSeconds.textContent = String(seconds).padStart(2, "0");
}
function setupRevealAnimations() {
  const elements = Array.from(document.querySelectorAll(".fade-in:not(.is-visible)"));
  if (typeof window.IntersectionObserver !== "function") {
    elements.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.2 }
  );

  elements.forEach((item) => observer.observe(item));
}

function setActiveBottomNav(hash) {
  el.navLinks.forEach((link) => {
    const targetHash = link.getAttribute("href");
    const giftCategory = link.dataset.giftCategoryTab;
    const isActive = giftCategory
      ? hash === "#presentes" && state.activePage === "presentes" && normalizeGiftCategory(giftCategory) === state.giftCategory
      : targetHash === hash;
    link.classList.toggle("is-active", isActive);
  });
}

function resolvePageTarget(target) {
  const normalizedTarget = String(target || "")
    .replace(/^#/, "")
    .trim()
    .toLowerCase();

  if (!normalizedTarget || normalizedTarget === "inicio-conteudo") {
    return "inicio";
  }

  const availablePages = listAvailablePages();
  if (availablePages.includes(normalizedTarget)) {
    return normalizedTarget;
  }

  return "inicio";
}

function listAvailablePages() {
  const fromNav = (el.navLinks || [])
    .map((link) => String(link.getAttribute("href") || "").replace(/^#/, "").trim().toLowerCase())
    .filter(Boolean);
  const fromViews = (el.pageViews || [])
    .map((view) => String(view.dataset.page || "").trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...fromNav, ...fromViews]));
}

function showPage(pageId, options = {}) {
  const nextPage = resolvePageTarget(pageId);
  const nextHash = `#${nextPage}`;

  state.activePage = nextPage;
  if (nextPage !== "presentes") {
    setGiftMenuExpanded(false);
  }

  (el.pageViews || []).forEach((view) => {
    const viewPage = String(view.dataset.page || "").trim().toLowerCase();
    const isActive = viewPage === nextPage;
    view.hidden = !isActive;
    if (isActive && view.classList.contains("fade-in")) {
      view.classList.add("is-visible");
    }
  });

  setActiveBottomNav(nextHash);
  renderGiftCategoryUI();

  if (options.updateHash && window.location.hash !== nextHash) {
    if (options.replaceHash && window.history && typeof window.history.replaceState === "function") {
      window.history.replaceState(null, "", nextHash);
    } else {
      window.location.hash = nextPage;
    }
  }

  if (options.resetScroll !== false) {
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}

function itemStatusHelperMarkup(item) {
  if (!item.reservedBy) return "";
  if (item.status === "pending") {
    return `<p class="gift-card__reserved-by">Compra informada por ${escapeHtml(item.reservedBy)}</p>`;
  }
  if (item.status === "purchased") {
    return `<p class="gift-card__reserved-by">Comprado por ${escapeHtml(item.reservedBy)}</p>`;
  }
  return "";
}

function labelForStatus(status) {
  if (status === "pending") return "Aguardando";
  if (status === "purchased") return "Comprado";
  return "Disponível";
}

function normalizeGiftCategory(category) {
  return category === "honeymoon" ? "honeymoon" : "registry";
}

function normalizeStatus(status) {
  if (status === "pending" || status === "purchased") return status;
  return "available";
}

function priceMatchesRange(price, range) {
  if (range === "all") return true;
  if (range === "0-150") return price <= 150;
  if (range === "151-300") return price >= 151 && price <= 300;
  if (range === "301-600") return price >= 301 && price <= 600;
  if (range === "601+") return price >= 601;
  return true;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatEventDate(dateInput) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "Data a definir";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTime(dateInput) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "Agora";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildWhatsAppLink(message) {
  const digits = String(CONFIG.whatsappPhone || "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function buildMapsEmbedUrl() {
  const query = "Casa Berlins, Pilar - AL";
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=17&output=embed`;
}

function buildCoupleInitials(names) {
  const chunks = String(names || "")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part && part.toLowerCase() !== "e" && part !== "&");
  if (!chunks.length) return "C & C";
  const first = chunks[0].charAt(0).toUpperCase();
  const second = (chunks[1] || chunks[chunks.length - 1]).charAt(0).toUpperCase();
  return `${first} & ${second}`;
}

function readJson(key, fallbackValue) {
  try {
    const raw = readFromStorage("local", key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

function readFromStorage(kind, key) {
  try {
    const storage = kind === "session" ? window.sessionStorage : window.localStorage;
    return storage.getItem(key);
  } catch (error) {
    return Object.prototype.hasOwnProperty.call(memoryStorage[kind], key)
      ? memoryStorage[kind][key]
      : null;
  }
}

function writeToStorage(kind, key, value) {
  const normalizedValue = String(value);
  try {
    const storage = kind === "session" ? window.sessionStorage : window.localStorage;
    storage.setItem(key, normalizedValue);
  } catch (error) {
    memoryStorage[kind][key] = normalizedValue;
  }
}

function removeFromStorage(kind, key) {
  try {
    const storage = kind === "session" ? window.sessionStorage : window.localStorage;
    storage.removeItem(key);
  } catch (error) {
    delete memoryStorage[kind][key];
  }
}

function syncBodyModalState() {
  document.body.classList.remove("modal-open");
}

function showToast(message) {
  if (!el.toast) return;
  el.toast.textContent = message;
  el.toast.classList.add("is-visible");

  if (state.toastTimer) {
    window.clearTimeout(state.toastTimer);
  }

  state.toastTimer = window.setTimeout(() => {
    el.toast.classList.remove("is-visible");
  }, 1800);
}

function formatErrorMessage(error, fallbackMessage) {
  if (error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  return fallbackMessage;
}

function isMissingRsvpDeleteFunctionError(error) {
  const message = error && typeof error.message === "string"
    ? error.message
    : "";
  return message.includes("wedding_delete_rsvp_response");
}

function isMissingPurchaseDeleteFunctionError(error) {
  const message = error && typeof error.message === "string"
    ? error.message
    : "";
  return message.includes("wedding_delete_purchase_item");
}

function isMissingGuestMessageDeleteFunctionError(error) {
  const message = error && typeof error.message === "string"
    ? error.message
    : "";
  return message.includes("wedding_delete_guest_message");
}

function handleInitError(error) {
  console.error("Falha ao inicializar o site de casamento:", error);

  document.querySelectorAll(".fade-in").forEach((section) => section.classList.add("is-visible"));

  try {
    cacheElements();
  } catch (cacheError) {
    console.error("Falha ao recapturar elementos:", cacheError);
  }

  renderGiftCategoryUI();

  const fallbackItems = Array.isArray(window.WEDDING_ITEMS) ? window.WEDDING_ITEMS : [];
  const activeCategory = normalizeGiftCategory(state.giftCategory);
  const visibleFallbackItems = fallbackItems.filter(
    (item) => normalizeGiftCategory(item.category) === activeCategory
  );

  if (el.giftList) {
    el.giftList.innerHTML = visibleFallbackItems
      .map(
        (item) => `
          <article class="gift-card" data-id="${item.id}">
            <img class="gift-card__img" src="${item.imagem}" alt="${escapeHtml(item.nome)}" loading="lazy" decoding="async">
            <div class="gift-card__body">
              <div class="gift-card__head">
                <div>
                  <h3 class="gift-card__title">${escapeHtml(item.nome)}</h3>
                  <p class="gift-card__desc">${escapeHtml(item.descricao)}</p>
                </div>
                <span class="status-badge" data-status="available">Disponível</span>
              </div>
              <p class="gift-card__price">${formatCurrency(item.preco)}</p>
              <div class="gift-card__actions">
                <a class="btn btn--primary" href="${item.links && item.links.external ? item.links.external : CONFIG.defaultLinks.externalStore}" target="_blank" rel="noopener noreferrer">Presentear</a>
              </div>
            </div>
          </article>
        `
      )
      .join("");
  }

  if (el.giftEmptyState) {
    el.giftEmptyState.hidden = visibleFallbackItems.length !== 0;
  }

  if (el.purchasedEmptyState) {
    el.purchasedEmptyState.hidden = false;
  }

  if (el.purchasedList) {
    el.purchasedList.innerHTML = "";
  }
}

function isValidPurchaseRequest(request) {
  return Boolean(
    request
    && typeof request.id === "string"
    && typeof request.itemId === "number"
    && typeof request.itemName === "string"
    && typeof request.guestName === "string"
    && typeof request.submittedAt === "string"
  );
}

function isValidRsvpResponse(response) {
  return Boolean(
    response
    && typeof response.id === "string"
    && typeof response.guestName === "string"
    && typeof response.submittedAt === "string"
  );
}

function isValidGuestMessage(message) {
  return Boolean(
    message
    && typeof message.id === "string"
    && typeof message.guestName === "string"
    && typeof message.messageText === "string"
    && typeof message.submittedAt === "string"
  );
}

function normalizeGuestMessage(message) {
  return {
    id: String(message.id),
    guestName: String(message.guestName || "Convidado"),
    guestEmail: String(message.guestEmail || ""),
    messageText: String(message.messageText || "").slice(0, 4000),
    submittedAt: String(message.submittedAt || new Date().toISOString()),
  };
}

function normalizeRsvpAttendanceChoice(value) {
  if (value === "no") return "no";
  if (value === "yes") return "yes";
  return "yes";
}

function normalizeLocalRsvpResponse(response) {
  return {
    ...response,
    attendanceChoice: normalizeRsvpAttendanceChoice(response.attendanceChoice),
  };
}

function createRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
