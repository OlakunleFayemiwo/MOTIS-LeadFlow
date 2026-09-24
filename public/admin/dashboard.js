document.addEventListener("DOMContentLoaded", () => {
  // --- Elements ---
  const loginSection = document.getElementById("loginSection");
  const dashboardSection = document.getElementById("dashboardSection");
  const loginForm = document.getElementById("loginForm");
  const passwordInput = document.getElementById("passwordInput");
  const loginError = document.getElementById("loginError");
  const logoutBtn = document.getElementById("logoutBtn");

  // Portal Views
  const viewAdmin = document.getElementById("view-admin");
  const viewSales = document.getElementById("view-sales");
  const viewProduction = document.getElementById("view-production");

  // Tables & States
  const salesTableBody = document.getElementById("salesTableBody");
  const productionTableBody = document.getElementById("productionTableBody");
  const salesLoadingState = document.getElementById("salesLoadingState");
  const salesEmptyState = document.getElementById("salesEmptyState");
  const salesMobileList = document.getElementById("salesMobileList");
  const productionEmptyState = document.getElementById("productionEmptyState");
  const productionMobileList = document.getElementById("productionMobileList");

  // Lead Detail Modal Elements
  const leadModal = document.getElementById("leadModal");
  const modalName = document.getElementById("modal-name");
  const modalPhone = document.getElementById("modal-phone");
  const modalEmail = document.getElementById("modal-email");
  const modalBrand = document.getElementById("modal-brand");
  const modalLocation = document.getElementById("modal-location");
  const modalProductLine = document.getElementById("modal-productLine");
  const modalQuantity = document.getElementById("modal-quantity");
  const modalMessage = document.getElementById("modal-message");
  const modalStatusSelect = document.getElementById("modal-statusSelect");
  const saveStatusBtn = document.getElementById("saveStatusBtn");
  const copilotDraftArea = document.getElementById("copilotDraftArea");
  const copilotSections = document.getElementById("copilotSections");
  const generateCoPilotBtn = document.getElementById("generateCoPilotBtn");
  const copyDraftBtn = document.getElementById("copyDraftBtn");

  // Chemical Workslip Modal Elements
  const workslipModal = document.getElementById("workslipModal");
  const workslipId = document.getElementById("workslip-id");
  const workslipClient = document.getElementById("workslip-client");
  const workslipLocation = document.getElementById("workslip-location");
  const workslipProduct = document.getElementById("workslip-product");
  const workslipVolume = document.getElementById("workslip-volume");

  // Global State
  let currentLeads = [];
  let selectedLead = null;
  let currentActiveRole = "admin"; // 'admin' | 'sales' | 'production'

  // --- Toast notifications (non-blocking replacement for alert()) ---
  let activeToastTimer = null;
  function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    container.innerHTML = "";
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.setAttribute("role", "status");
    const icon = document.createElement("span");
    icon.className = "material-symbols-outlined text-base shrink-0";
    icon.textContent = type === "error" ? "error_outline" : "check_circle";
    icon.style.color = type === "error" ? "#ef4444" : "#22c55e";
    const text = document.createElement("span");
    text.textContent = message;
    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("toast-visible"));
    if (activeToastTimer) clearTimeout(activeToastTimer);
    activeToastTimer = setTimeout(() => {
      toast.classList.remove("toast-visible");
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }

  // --- Authentication ---
  async function checkAuth() {
    showLogin();
    await fetchLeads();
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("/.netlify/functions/crmLogin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput.value }),
      });

      if (!response.ok) throw new Error("Login failed");

      loginError.classList.add("hidden-section");
      passwordInput.value = "";
      showDashboard();
      fetchLeads();
    } catch (error) {
      loginError.classList.remove("hidden-section");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/.netlify/functions/crmLogout", { method: "POST" });
    } finally {
      currentLeads = [];
      showLogin();
    }
  });

  function showLogin() {
    loginSection.classList.remove("hidden-section");
    dashboardSection.classList.add("hidden-section");
    logoutBtn.classList.add("hidden-section");
  }

  function showDashboard() {
    loginSection.classList.add("hidden-section");
    dashboardSection.classList.remove("hidden-section");
    logoutBtn.classList.remove("hidden-section");
  }

  // --- Role switcher ---
  window.switchRole = function (role) {
    currentActiveRole = role;

    // Reset sidebar button UI states
    ["admin", "sales", "production"].forEach((r) => {
      const btn = document.getElementById(`roleBtn-${r}`);
      if (r === role) {
        btn.className =
          "w-full text-left flex items-center space-x-3 px-4 py-3 rounded-sm text-sm font-semibold transition-all bg-white/5 border border-white/10 text-white shadow-sm";
        btn
          .querySelector("span:first-child")
          .classList.add("text-motis-orange");
      } else {
        btn.className =
          "w-full text-left flex items-center space-x-3 px-4 py-3 rounded-sm text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-white/5 border border-transparent";
        btn
          .querySelector("span:first-child")
          .classList.remove("text-motis-orange");
      }
    });

    // Toggle visibility of panels
    viewAdmin.classList.add("hidden-section");
    viewSales.classList.add("hidden-section");
    viewProduction.classList.add("hidden-section");

    if (role === "admin") viewAdmin.classList.remove("hidden-section");
    if (role === "sales") viewSales.classList.remove("hidden-section");
    if (role === "production")
      viewProduction.classList.remove("hidden-section");

    renderActiveRoleView();
  };

  // --- Data Sync ---
  window.fetchLeads = async function () {
    salesTableBody.innerHTML = "";
    productionTableBody.innerHTML = "";
    salesMobileList.innerHTML = "";
    productionMobileList.innerHTML = "";
    salesEmptyState.classList.add("hidden-section");
    productionEmptyState.classList.add("hidden-section");
    salesLoadingState.classList.remove("hidden-section");

    try {
      const response = await fetch("/.netlify/functions/getLeads");
      if (response.status === 401) {
        showLogin();
        return;
      }
      if (!response.ok) throw new Error("API Sync Failed");

      const data = await response.json();
      currentLeads = data.leads || [];

      calculateAdminStatistics();
      renderActiveRoleView();
    } catch (error) {
      console.error("Dashboard DB fetch error:", error);
      // Render blank UI on fetch error
      salesEmptyState.classList.remove("hidden-section");
    } finally {
      salesLoadingState.classList.add("hidden-section");
    }
  };

  // --- Render Dispatcher ---
  function renderActiveRoleView() {
    if (currentActiveRole === "sales") {
      renderSalesPipeline();
    } else if (currentActiveRole === "production") {
      renderProductionFloor();
    }
  }

  // --- VIEW 1: ADMIN ANALYTICS ---
  function calculateAdminStatistics() {
    const total = currentLeads.length;
    const won = currentLeads.filter((l) => l.status === "won");

    // ILLUSTRATIVE DEMO FIGURES ONLY — not verified MOTIS pricing.
    // The per-drum/per-tin values and the partner commission percentage
    // below are demo assumptions and must not be treated as real MOTIS
    // business intelligence. UI labels mark them as illustrative.
    const DEMO_DRUM_VALUE = 150000;
    const DEMO_TIN_VALUE = 35000;
    let estRevenue = 0;
    won.forEach((lead) => {
      const qtyStr = String(lead.quantity || "").toLowerCase();
      const qtyNum = parseInt(qtyStr.match(/\d+/) || [50]); // default to 50 if unspecified
      if (qtyStr.includes("drum")) {
        estRevenue += qtyNum * DEMO_DRUM_VALUE;
      } else if (qtyStr.includes("tin")) {
        estRevenue += qtyNum * DEMO_TIN_VALUE;
      } else {
        // generic wholesale bulk estimate (demo drum-equivalent assumption)
        estRevenue += qtyNum * DEMO_DRUM_VALUE;
      }
    });

    // Set Stats Counter
    document.getElementById("stat-totalLeads").textContent = total;
    document.getElementById("stat-wonLeads").textContent = won.length;
    document.getElementById("stat-estRevenue").textContent =
      "₦" + estRevenue.toLocaleString("en-NG");

    // Capture unique partners
    const partners = [
      ...new Set(
        currentLeads.filter((l) => l.referrer_id).map((l) => l.referrer_id),
      ),
    ];
    document.getElementById("stat-activePartners").textContent =
      partners.length;

    // Brand Distributions
    const industrialLeads = currentLeads.filter(
      (l) => l.brand === "motis_industrial",
    ).length;
    const morePaintLeads = currentLeads.filter(
      (l) => l.brand === "more_paint",
    ).length;

    const indPercent =
      total > 0 ? Math.round((industrialLeads / total) * 100) : 0;
    const mpPercent =
      total > 0 ? Math.round((morePaintLeads / total) * 100) : 0;

    document.getElementById("brandPercent-industrial").textContent =
      indPercent + "%";
    document.getElementById("brandPercent-morePaint").textContent =
      mpPercent + "%";
    document.getElementById("brandBar-industrial").style.width =
      indPercent + "%";
    document.getElementById("brandBar-morePaint").style.width = mpPercent + "%";

    // Affiliate Leaderboard compiling
    compilePartnerLeaderboard();
  }

  function compilePartnerLeaderboard() {
    const boardContainer = document.getElementById("leaderboardContainer");
    boardContainer.innerHTML = "";

    // Compile referrer metrics. The commission figure is an ILLUSTRATIVE
    // demo assumption (10% of an assumed order value) — not verified
    // MOTIS business data.
    const ILLUSTRATIVE_COMMISSION_RATE = 0.1;
    const partnerMap = {};
    currentLeads.forEach((lead) => {
      if (!lead.referrer_id) return;
      const ref = lead.referrer_id.trim();
      if (!partnerMap[ref]) {
        partnerMap[ref] = {
          name: ref,
          totalLeads: 0,
          wonLeads: 0,
          commission: 0,
        };
      }
      partnerMap[ref].totalLeads += 1;
      if (lead.status === "won") {
        partnerMap[ref].wonLeads += 1;
        // Illustrative demo commission calculation (assumed order value)
        const qtyStr = String(lead.quantity || "").toLowerCase();
        const qtyNum = parseInt(qtyStr.match(/\d+/) || [50]);
        const baseVal = qtyStr.includes("tin")
          ? qtyNum * 35000
          : qtyNum * 150000;
        partnerMap[ref].commission += Math.round(baseVal * ILLUSTRATIVE_COMMISSION_RATE); // demo 10% assumption
      }
    });

    const sortedPartners = Object.values(partnerMap).sort(
      (a, b) => b.commission - a.commission,
    );

    if (sortedPartners.length === 0) {
      boardContainer.innerHTML = `
                <div class="text-center py-10 text-slate-500 text-sm font-light">
                    No partner referrals recorded in database yet.
                </div>`;
      return;
    }

    sortedPartners.forEach((partner, idx) => {
      const row = document.createElement("div");
      row.className =
        "flex justify-between items-center bg-slate-950/50 border border-white/5 p-4 rounded-sm hover:border-motis-orange/20 transition-all";
      row.innerHTML = `
                <div class="flex items-center space-x-3">
                    <span class="font-heading font-black text-sm text-slate-500 w-5">#${idx + 1}</span>
                    <div>
                        <span class="font-bold text-white uppercase text-xs tracking-wider">${escapeHtml(partner.name)}</span>
                        <div class="text-[10px] text-slate-500 mt-0.5">Leads: ${partner.totalLeads} | Conversions: ${partner.wonLeads}</div>
                    </div>
                </div>
                <div class="text-right">
                    <span class="font-heading font-bold text-xs text-motis-orange block">₦${partner.commission.toLocaleString("en-NG")}</span>
                    <span class="text-[9px] uppercase tracking-wider text-slate-600 block">Commission (Illustrative Demo)</span>
                </div>`;
      boardContainer.appendChild(row);
    });
  }

  // --- VIEW 2: SALES PIPELINE ---
  function renderSalesPipeline() {
    salesTableBody.innerHTML = "";
    salesEmptyState.classList.add("hidden-section");

    if (currentLeads.length === 0) {
      salesEmptyState.classList.remove("hidden-section");
      return;
    }

    currentLeads.forEach((lead) => {
      const date = new Date(lead.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const statusLabels = {
        new: "New",
        contacted: "Contacted",
        qualified: "Qualified",
        won: "Won",
        lost: "Lost",
      };

      // Status pills
      let statusColor =
        "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400";
      if (lead.status === "won")
        statusColor =
          "bg-green-500/10 border border-green-500/20 text-green-400";
      if (lead.status === "lost")
        statusColor = "bg-red-500/10 border border-red-500/20 text-red-400";
      if (lead.status === "contacted")
        statusColor = "bg-blue-500/10 border border-blue-500/20 text-blue-400";
      if (lead.status === "qualified")
        statusColor = "bg-purple-500/10 border border-purple-500/20 text-purple-400";

      const tr = document.createElement("tr");
      tr.className =
        "hover:bg-white/5 transition-colors border-b border-white/5";
      tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-slate-400 text-xs">${date}</td>
                <td class="px-6 py-4 font-bold text-white">
                    ${escapeHtml(lead.name || "N/A")}
                    ${lead.referrer_id ? `<div class="text-[9px] tracking-wider text-motis-orange uppercase mt-1">Ref: ${escapeHtml(lead.referrer_id)}</div>` : ""}
                </td>
                <td class="px-6 py-4">
                    <span class="inline-flex px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-white/5 border border-white/10 text-slate-300 uppercase tracking-wider">
                        ${lead.brand === "more_paint" ? "More Paint" : "Motis Indus."}
                    </span>
                </td>
                <td class="px-6 py-4 text-xs font-semibold text-slate-300 max-w-[200px] truncate">
                    ${escapeHtml((lead.product_line || "custom formulation").replace("motis_", "").replace("more_paint_", "").replace("-", " "))}
                    ${lead.quantity ? `<div class="text-[10px] text-slate-500 font-light mt-0.5">Quantity: ${escapeHtml(lead.quantity)}</div>` : ""}
                </td>
                <td class="px-6 py-4">
                    <span class="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColor}">
                        ${statusLabels[lead.status] || "New"}
                    </span>
                </td>
                <td class="px-6 py-4 text-right">
                    <button onclick="openLeadModal('${lead.id}')" class="bg-motis-slate hover:bg-slate-800 text-white text-xs font-semibold px-3.5 py-2 rounded-sm border border-white/5 transition-colors">
                        View Lead
                    </button>
                </td>`;
      salesTableBody.appendChild(tr);

      const mobileCard = document.createElement("article");
      mobileCard.className = "crm-mobile-card";
      mobileCard.innerHTML =
        '<div class="flex items-start justify-between gap-3 mb-3"><div class="min-w-0"><h3 class="font-bold text-white text-base truncate">' + escapeHtml(lead.name || "N/A") + '</h3><p class="text-xs text-slate-500 mt-1">' + date + '</p></div><span class="shrink-0 inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ' + statusColor + '">' + (statusLabels[lead.status] || "New") + '</span></div>' +
        '<dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-xs mb-4"><div><dt class="text-slate-500 uppercase tracking-wider mb-1">Brand</dt><dd class="text-slate-300">' + (lead.brand === "more_paint" ? "More Paint" : "Motis Industrial") + '</dd></div><div><dt class="text-slate-500 uppercase tracking-wider mb-1">Product</dt><dd class="text-slate-300 truncate">' + escapeHtml((lead.product_line || "Not specified").replace("motis_", "").replace("more_paint_", "").replace("-", " ")) + '</dd></div><div><dt class="text-slate-500 uppercase tracking-wider mb-1">Quantity</dt><dd class="text-slate-300">' + escapeHtml(lead.quantity || "Not specified") + '</dd></div><div><dt class="text-slate-500 uppercase tracking-wider mb-1">Location</dt><dd class="text-slate-300 truncate">' + escapeHtml(lead.location || "Not provided") + '</dd></div></dl>' +
        '<button onclick="openLeadModal(\'' + lead.id + '\')" class="bg-motis-slate hover:bg-slate-800 text-white text-xs font-semibold px-3.5 py-2 rounded-sm border border-white/5 transition-colors">View Lead</button>';
      salesMobileList.appendChild(mobileCard);
    });
  }

  // --- VIEW 3: FULFILLMENT REVIEW ---
  // A won lead is a sales outcome only. This view lists won leads for
  // neutral fulfillment review; it must never read as, or trigger,
  // production authorization, and no technical formulas are derived
  // from sales data here.
  function renderProductionFloor() {
    productionTableBody.innerHTML = "";
    productionEmptyState.classList.add("hidden-section");

    const wonLeads = currentLeads.filter((l) => l.status === "won");

    if (wonLeads.length === 0) {
      productionEmptyState.classList.remove("hidden-section");
      return;
    }

    wonLeads.forEach((lead, idx) => {
      const orderNum = `REF-#${String(1000 + idx)}`;
      const productBase = escapeHtml(
        (lead.product_line || "As requested by customer")
          .replace("more_paint_", "")
          .replace("motis_", "")
          .replace("-", " "),
      );
      const volumeStr = escapeHtml(lead.quantity || "Not specified");

      const tr = document.createElement("tr");
      tr.className =
        "hover:bg-white/5 transition-colors border-b border-white/5";
      tr.innerHTML = `
                <td class="px-6 py-4 font-bold text-white tracking-widest text-xs">${orderNum}</td>
                <td class="px-6 py-4 font-semibold text-slate-300 uppercase text-xs">${productBase}</td>
                <td class="px-6 py-4 text-xs text-white font-bold">${volumeStr}</td>
                <td class="px-6 py-4 text-xs text-slate-400">${escapeHtml(lead.location || "N/A")}</td>
                <td class="px-6 py-4 text-right">
                    <button onclick="openWorkslipModal('${lead.id}', '${orderNum}')" class="bg-slate-900 hover:bg-black text-white text-xs font-semibold px-4 py-2 border border-slate-700 rounded-sm transition-colors flex items-center justify-center space-x-2 inline-block">
                        <span class="material-symbols-outlined text-xs">fact_check</span>
                        <span>Review Summary</span>
                    </button>
                </td>`;
      productionTableBody.appendChild(tr);

      const mobileCard = document.createElement("article");
      mobileCard.className = "crm-mobile-card";
      mobileCard.innerHTML =
        '<div class="flex items-start justify-between gap-3 mb-3"><div><p class="text-[10px] text-slate-500 uppercase tracking-wider">Reference</p><h3 class="font-bold text-white text-base">' + orderNum + '</h3></div><span class="text-[10px] uppercase tracking-wider text-slate-500">Won lead</span></div>' +
        '<dl class="grid grid-cols-1 gap-3 text-xs mb-4"><div><dt class="text-slate-500 uppercase tracking-wider mb-1">Product</dt><dd class="text-slate-300">' + productBase + '</dd></div><div><dt class="text-slate-500 uppercase tracking-wider mb-1">Requested Quantity</dt><dd class="text-slate-300">' + volumeStr + '</dd></div><div><dt class="text-slate-500 uppercase tracking-wider mb-1">Delivery Location</dt><dd class="text-slate-300">' + escapeHtml(lead.location || "Not provided") + '</dd></div></dl>' +
        '<button onclick="openWorkslipModal(\'' + lead.id + '\', \'' + orderNum + '\')" class="bg-slate-900 hover:bg-black text-white text-xs font-semibold px-4 py-2 border border-slate-700 rounded-sm transition-colors flex items-center justify-center space-x-2"><span class="material-symbols-outlined text-xs">fact_check</span><span>Review Summary</span></button>';
      productionMobileList.appendChild(mobileCard);
    });
  }

  // --- LEAD SPEC/COPILOT MODAL HANDLERS ---
  window.openLeadModal = function (id) {
    selectedLead = currentLeads.find((l) => String(l.id) === String(id));
    if (!selectedLead) return;

    // Reset copilot draft
    copilotDraftArea.value = "";
    copilotSections.classList.add("hidden-section");
    copilotSections.innerHTML = "";

    // Populate detail views
    modalName.textContent = escapeHtml(selectedLead.name);
    modalPhone.textContent =
      "Phone: " + escapeHtml(selectedLead.phone || "N/A");
    modalEmail.textContent =
      "Email: " + escapeHtml(selectedLead.email || "N/A");
    modalLocation.textContent = escapeHtml(selectedLead.location || "N/A");
    modalProductLine.textContent = escapeHtml(
      (selectedLead.product_line || "Custom Formulation")
        .replace("_", " ")
        .replace("-", " "),
    );
    modalQuantity.textContent = selectedLead.quantity
      ? `Quantity requested: ${selectedLead.quantity}`
      : "Quantity requested: not specified";
    modalMessage.textContent = escapeHtml(
      selectedLead.message || "No specific project message.",
    );

    // Brand division tag color
    modalBrand.textContent =
      selectedLead.brand === "more_paint"
        ? "More Paint Division"
        : "Industrial Division";
    modalBrand.className =
      selectedLead.brand === "more_paint"
        ? "inline-flex px-3 py-1 rounded-sm text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400"
        : "inline-flex px-3 py-1 rounded-sm text-xs font-semibold bg-motis-orange/10 border border-motis-orange/20 text-motis-orange";

    modalStatusSelect.value = selectedLead.status || "new";

    // Display Modal
    leadModal.classList.remove("opacity-0", "pointer-events-none");
  };

  window.closeLeadModal = function () {
    leadModal.classList.add("opacity-0", "pointer-events-none");
    selectedLead = null;
  };

  // Save status change
  saveStatusBtn.addEventListener("click", async () => {
    if (!selectedLead) return;
    const targetStatus = modalStatusSelect.value;

    saveStatusBtn.textContent = "Updating...";
    saveStatusBtn.disabled = true;

    try {
      const response = await fetch("/.netlify/functions/updateLead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId: selectedLead.id,
          status: targetStatus,
          admin_notes: `Status updated to ${targetStatus}.`,
        }),
      });

      const result = await response.json();
      if (response.status === 401) {
        closeLeadModal();
        showLogin();
        return;
      }
      if (response.ok && result.success) {
        showToast("Lead updated successfully.", "success");
        closeLeadModal();
        fetchLeads(); // Sync database
      } else {
        throw new Error(result.message || "API rejected update");
      }
    } catch (error) {
      console.error("CRM Update failed:", error);
      showToast("Unable to update lead. Please try again.", "error");
    } finally {
      saveStatusBtn.textContent = "Save";
      saveStatusBtn.disabled = false;
    }
  });

  // --- AI CO-PILOT LEAD REVIEW (real Gemini inference, operator in control) ---
  const copilotSectionLabels = {
    lead_summary: "Lead Summary",
    customer_intent: "Customer Intent",
    missing_information: "Missing Information / Clarification Questions",
    qualification_observations: "Qualification Observations",
  };

  function renderCoPilotSections(coPilot) {
    copilotSections.innerHTML = "";
    Object.entries(copilotSectionLabels).forEach(([key, label]) => {
      const block = document.createElement("div");
      block.className =
        "bg-slate-950/50 border border-white/5 rounded-sm p-3";
      block.innerHTML = `
                <span class="text-[10px] font-semibold tracking-wider text-motis-orange uppercase block mb-1">${escapeHtml(label)}</span>
                <p class="text-slate-300 whitespace-pre-wrap"></p>`;
      // Text content only — never inject AI output as raw HTML.
      block.querySelector("p").textContent = coPilot[key] || "";
      copilotSections.appendChild(block);
    });
    copilotSections.classList.remove("hidden-section");
  }

  window.generateCoPilotDraft = async function () {
    if (!selectedLead) return;

    copilotSections.classList.add("hidden-section");
    copilotSections.innerHTML = "";
    copilotDraftArea.value = "Analyzing lead with AI Co-Pilot... please wait...";
    generateCoPilotBtn.disabled = true;

    try {
      const response = await fetch("/.netlify/functions/crmCoPilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: selectedLead.id }),
      });

      if (response.status === 401) {
        copilotDraftArea.value = "";
        closeLeadModal();
        showLogin();
        return;
      }

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "AI Co-Pilot request failed");
      }

      const coPilot = result.coPilot || {};
      renderCoPilotSections(coPilot);
      copilotDraftArea.value =
        coPilot.suggested_response_draft ||
        "No draft was produced. Please try again.";
    } catch (error) {
      console.error("AI Co-Pilot failed:", error);
      copilotSections.classList.add("hidden-section");
      copilotDraftArea.value = "";
      showToast("The AI Co-Pilot could not complete the review. Please try again.", "error");
    } finally {
      generateCoPilotBtn.disabled = false;
    }
  };

  // Copy draft helper
  copyDraftBtn.addEventListener("click", () => {
    const text = copilotDraftArea.value;
    if (!text || text.startsWith("Analyzing")) return;
    navigator.clipboard.writeText(text);
    copyDraftBtn.querySelector("span:last-child").textContent = "Copied!";
    setTimeout(() => {
      copyDraftBtn.querySelector("span:last-child").textContent = "Copy Draft";
    }, 2000);
  });

  // --- FULFILLMENT REVIEW SUMMARY HANDLERS ---
  // Neutral sales-conversion summary only. No technical formulas,
  // blending ratios, or production instructions are derived from sales
  // leads; the modal states that production authorization is separate.
  window.openWorkslipModal = function (leadId, orderNo) {
    const lead = currentLeads.find((l) => String(l.id) === String(leadId));
    if (!lead) return;

    workslipId.textContent = orderNo;
    workslipClient.textContent = escapeHtml(lead.name);
    workslipLocation.textContent = escapeHtml(
      lead.location || "Not provided",
    );

    const productName = escapeHtml(
      (lead.product_line || "Not specified")
        .replace("more_paint_", "")
        .replace("motis_", "")
        .replace("-", " "),
    );
    workslipProduct.textContent = productName.toUpperCase();
    workslipVolume.textContent = lead.quantity || "Not specified";

    workslipModal.classList.remove("opacity-0", "pointer-events-none");
  };

  window.closeWorkslipModal = function () {
    workslipModal.classList.add("opacity-0", "pointer-events-none");
  };

  // --- CSV Export ---
  function exportToCSV() {
    if (currentLeads.length === 0) return;

    const headers = [
      "Date",
      "Name",
      "Phone",
      "Email",
      "Location",
      "Product Line",
      "Quantity",
      "Status",
      "Message",
    ];
    const csvRows = [];

    csvRows.push(headers.join(","));

    currentLeads.forEach((lead) => {
      const values = [
        lead.created_at,
        lead.name,
        lead.phone,
        lead.email,
        lead.location,
        lead.product_line,
        lead.quantity,
        lead.status,
        lead.message,
      ].map((val) => {
        const stringVal = String(val || "");
        return `"${stringVal.replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(","));
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.setAttribute("hidden", "");
    a.setAttribute("href", url);
    a.setAttribute(
      "download",
      `motis-crm-leads-${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // --- Utils ---
  function escapeHtml(unsafe) {
    return (unsafe || "")
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // --- Listeners ---
  exportCsvBtn.addEventListener("click", exportToCSV);

  // Init
  checkAuth();
});
