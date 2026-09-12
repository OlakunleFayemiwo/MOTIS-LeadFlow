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
  const productionEmptyState = document.getElementById("productionEmptyState");

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
  const copyDraftBtn = document.getElementById("copyDraftBtn");

  // Chemical Workslip Modal Elements
  const workslipModal = document.getElementById("workslipModal");
  const workslipId = document.getElementById("workslip-id");
  const workslipClient = document.getElementById("workslip-client");
  const workslipLocation = document.getElementById("workslip-location");
  const workslipProduct = document.getElementById("workslip-product");
  const workslipVolume = document.getElementById("workslip-volume");
  const workslipFormulaBody = document.getElementById("workslipFormulaBody");

  // Global State
  let currentLeads = [];
  let selectedLead = null;
  let currentActiveRole = "admin"; // 'admin' | 'sales' | 'production'

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

    // Dynamic Revenue Math (e.g. 1 drum = N150,000, 1 tin = N35,000)
    let estRevenue = 0;
    won.forEach((lead) => {
      const qtyStr = String(lead.quantity || "").toLowerCase();
      const qtyNum = parseInt(qtyStr.match(/\d+/) || [50]); // default to 50 if unspecified
      if (qtyStr.includes("drum")) {
        estRevenue += qtyNum * 150000;
      } else if (qtyStr.includes("tin")) {
        estRevenue += qtyNum * 35000;
      } else {
        // generic wholesale bulk estimate (N150,000 per drum equivalent)
        estRevenue += qtyNum * 150000;
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

    // Compile referrers metrics
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
        // Calculate estimated partner commission (10% commission on bulk sales value)
        const qtyStr = String(lead.quantity || "").toLowerCase();
        const qtyNum = parseInt(qtyStr.match(/\d+/) || [50]);
        const baseVal = qtyStr.includes("tin")
          ? qtyNum * 35000
          : qtyNum * 150000;
        partnerMap[ref].commission += Math.round(baseVal * 0.1); // 10% cut
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
                    <span class="text-[9px] uppercase tracking-wider text-slate-600 block">Est. Commission Paid</span>
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
                        Protocol Spec
                    </button>
                </td>`;
      salesTableBody.appendChild(tr);
    });
  }

  // --- VIEW 3: CHEMICAL FACTORY FLOOR ---
  function renderProductionFloor() {
    productionTableBody.innerHTML = "";
    productionEmptyState.classList.add("hidden-section");

    const wonLeads = currentLeads.filter((l) => l.status === "won");

    if (wonLeads.length === 0) {
      productionEmptyState.classList.remove("hidden-section");
      return;
    }

    wonLeads.forEach((lead, idx) => {
      const orderNum = `BATCH-#M${String(1000 + idx)}`;
      const productBase = escapeHtml(
        (lead.product_line || "Standard Paint")
          .replace("more_paint_", "")
          .replace("motis_", "")
          .replace("-", " "),
      );
      const volumeStr = escapeHtml(lead.quantity || "50 Drums (Default)");

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
                        <span class="material-symbols-outlined text-xs">print</span>
                        <span>Chemical Ticket</span>
                    </button>
                </td>`;
      productionTableBody.appendChild(tr);
    });
  }

  // --- LEAD SPEC/COPILOT MODAL HANDLERS ---
  window.openLeadModal = function (id) {
    selectedLead = currentLeads.find((l) => String(l.id) === String(id));
    if (!selectedLead) return;

    // Reset copilot draft
    copilotDraftArea.value = "";

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
      ? `Quantity Ordered: ${selectedLead.quantity}`
      : "Quantity: Unspecified Wholesale";
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
          admin_notes: `Status updated to ${targetStatus} via Enterprise CRM.`,
        }),
      });

      const result = await response.json();
      if (response.status === 401) {
        closeLeadModal();
        showLogin();
        return;
      }
      if (response.ok && result.success) {
        alert("Protocol Ledger Updated Successfully!");
        closeLeadModal();
        fetchLeads(); // Sync database
      } else {
        throw new Error(result.message || "API rejected update");
      }
    } catch (error) {
      console.error("CRM Update failed:", error);
      alert("Ledger update failed. Check your sync connection.");
    } finally {
      saveStatusBtn.textContent = "Save";
      saveStatusBtn.disabled = false;
    }
  });

  // --- AI CO-PILOT DRAFT GENERATOR ---
  window.generateCoPilotDraft = function (platform) {
    if (!selectedLead) return;

    copilotDraftArea.value = `Drafting response protocol... please wait...`;

    // Mock Gemini response compilation logic (highly structured and custom tailored)
    const name = selectedLead.name;
    const product = escapeHtml(
      (selectedLead.product_line || "Paint")
        .replace("more_paint_", "")
        .replace("motis_", "")
        .replace("-", " "),
    );
    const quantity = selectedLead.quantity || "wholesale quantity";
    const location = selectedLead.location || "Nigeria";

    let draft = "";

    if (platform === "whatsapp") {
      draft = `*MOTIS INDUSTRIES LIMITED - WHITESHEET ESTIMATION*\n\n`;
      draft += `Dear *${name}*,\n\n`;
      draft += `Thank you for consulting Motis Industries for your architectural project. Our Lead Chemist has compiled the technical specs for your *${product}* request.\n\n`;
      draft += `📍 *Delivery Location:* ${location}\n`;
      draft += `📦 *Formulation Volume:* ${quantity}\n\n`;

      // Coastal zone addition
      const locLower = location.toLowerCase();
      const isCoastalZone =
        locLower.includes("coast") ||
        locLower.includes("island") ||
        locLower.includes("lekki") ||
        locLower.includes("vi") ||
        locLower.includes("lagos") ||
        locLower.includes("port") ||
        locLower.includes("humid") ||
        locLower.includes("marsh");

      if (isCoastalZone) {
        draft += `⚠️ *Coastal Moisture Advisory:* Our records show your project site is in a coastal zone. We strongly recommend applying 1 coat of *Contractor Prep Undercoat* to block salt-water condensation before applying topcoats.\n\n`;
      }

      draft += `Our dispatch team is currently scheduling raw materials from dispersion room. Let us know if you'd like to lock in this wholesale batch. We can forward the official invoice shortly!\n\n`;
      draft += `Regards,\n*Motis Enterprise Sales team*`;
    } else {
      // Email Draft
      draft = `Subject: SUPPLY PROTOCOL: Motis Wholly-Formulated Architectural Coatings Estimate for ${name}\n\n`;
      draft += `Dear ${name},\n\n`;
      draft += `I hope this email finds you well.\n\n`;
      draft += `This is a formal communication from Motis Industries Limited regarding your wholesale quote request for our flagship architectural/industrial paint: ${product}.\n\n`;
      draft += `Our factory dispersion team has reviewed your project specifications. Based on your target volume of ${quantity} and deployment site in ${location}, we have reserved the raw polymers in our central ledger.\n\n`;

      const locLower = location.toLowerCase();
      const isCoastalZone =
        locLower.includes("coast") ||
        locLower.includes("island") ||
        locLower.includes("lekki") ||
        locLower.includes("vi") ||
        locLower.includes("lagos") ||
        locLower.includes("port") ||
        locLower.includes("humid") ||
        locLower.includes("marsh");

      if (isCoastalZone) {
        draft += `TECHNICAL NOTICE: Since your site is situated in a high-salinity coastal zone, our Lead Chemist recommends combining the exterior coating with our custom-engineered high-cross-linking primer to prevent future peeling or carbonation damage.\n\n`;
      }

      draft += `Please review and acknowledge if you would like to proceed with payment and logistics allocation. Our representative will follow up via phone shortly.\n\n`;
      draft += `Sincerely,\n\n`;
      draft += `Motis Enterprise Sales & Logistics\n`;
      draft += `Motis Industries Limited\n`;
      draft += `Website: https://www.motisindustries.com`;
    }

    copilotDraftArea.value = draft;
  };

  // Copy draft helper
  copyDraftBtn.addEventListener("click", () => {
    const text = copilotDraftArea.value;
    if (!text || text.startsWith("Drafting")) return;
    navigator.clipboard.writeText(text);
    copyDraftBtn.querySelector("span:last-child").textContent = "Copied!";
    setTimeout(() => {
      copyDraftBtn.querySelector("span:last-child").textContent = "Copy Draft";
    }, 2000);
  });

  // --- CHEMICAL WORKSIP HANDLERS ---
  window.openWorkslipModal = function (leadId, orderNo) {
    const lead = currentLeads.find((l) => String(l.id) === String(leadId));
    if (!lead) return;

    workslipId.textContent = orderNo;
    workslipClient.textContent = escapeHtml(lead.name);
    workslipLocation.textContent = escapeHtml(
      lead.location || "Lagos, Nigeria",
    );

    const productName = escapeHtml(
      (lead.product_line || "Standard Paint")
        .replace("more_paint_", "")
        .replace("motis_", "")
        .replace("-", " "),
    );
    workslipProduct.textContent = productName.toUpperCase();

    // Calculate volumes
    const qtyStr = String(lead.quantity || "").toLowerCase();
    let qtyNum = parseInt(qtyStr.match(/\d+/) || [50]);
    let totalLitres = qtyStr.includes("tin") ? qtyNum * 4 : qtyNum * 20;

    workslipVolume.textContent = `${qtyNum} ${qtyStr.includes("tin") ? "Tins" : "Drums"} (~${totalLitres.toLocaleString()} Litres)`;

    // Chemistry Blending Ratios (Unilever Scale Custom Formulas!)
    // 1. Base resin (70%)
    // 2. Pigment Titanium Dioxide (15%)
    // 3. Coalescents & Solvents (10%)
    // 4. Anti-humidity Polymer binders (5%)
    const constituentBase = totalLitres * 0.7;
    const constituentPigment = totalLitres * 0.15 * 1.4; // Pigments measured in kg equivalent (standard density ~1.4)
    const constituentSolvent = totalLitres * 0.1;
    const constituentAdhesion = totalLitres * 0.05;

    workslipFormulaBody.innerHTML = `
            <tr>
                <td class="p-2 font-bold text-slate-800 uppercase text-xs">Acrylic Copolymer / Epoxy Resin Base</td>
                <td class="p-2 text-slate-600 text-xs">70%</td>
                <td class="p-2 text-slate-900 font-bold text-xs text-right">${constituentBase.toLocaleString()} L</td>
            </tr>
            <tr>
                <td class="p-2 font-bold text-slate-800 uppercase text-xs">Titanium Dioxide White (TiO2) / Pigments</td>
                <td class="p-2 text-slate-600 text-xs">15%</td>
                <td class="p-2 text-slate-900 font-bold text-xs text-right">${constituentPigment.toLocaleString()} KG</td>
            </tr>
            <tr>
                <td class="p-2 font-bold text-slate-800 uppercase text-xs">Glycol Coalescents & Carrier Solvents</td>
                <td class="p-2 text-slate-600 text-xs">10%</td>
                <td class="p-2 text-slate-900 font-bold text-xs text-right">${constituentSolvent.toLocaleString()} L</td>
            </tr>
            <tr>
                <td class="p-2 font-bold text-slate-800 uppercase text-xs">Anti-humidity Cross-linking Binder / Preservatives</td>
                <td class="p-2 text-slate-600 text-xs">5%</td>
                <td class="p-2 text-slate-900 font-bold text-xs text-right">${constituentAdhesion.toLocaleString()} L</td>
            </tr>
        `;

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
