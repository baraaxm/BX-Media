document.addEventListener("DOMContentLoaded", async () => {
  // Require admin login
  const sess = BXCore.requireAuth({ role: "admin" });
  if (!sess) return;

  const statusEl = document.getElementById("addClientStatus");
  const actionStatusEl = document.getElementById("clientsActionStatus");
  const clientsTableWrapper = document.getElementById("clientsTableWrapper");
  const clientsCountEl = document.getElementById("clientsCount");
  const addClientBtn = document.getElementById("addClientBtn");
  const addClientModal = document.getElementById("addClientModal");
  const addClientModalClose = document.getElementById("addClientModalClose");
  const searchInput = document.getElementById("clientsSearch");
  const statusFilter = document.getElementById("clientsStatusFilter");
  const detailModal = document.getElementById("clientDetailModal");
  const detailClose = document.getElementById("clientModalClose");
  const detailBody = document.getElementById("clientModalBody");
  const detailTitle = document.getElementById("clientModalTitle");
  const detailSubtitle = document.getElementById("clientModalSubtitle");

  let data = null;
  let clients = [];
  let projects = [];
  let tasks = [];
  let actionsBound = false;
  let modalActionsBound = false;

  const showActionStatus = (message, type = "success") => {
    if (!actionStatusEl) return;
    actionStatusEl.classList.remove("alert-success", "alert-error", "alert-info");
    actionStatusEl.classList.add(`alert-${type}`);
    actionStatusEl.textContent = message;
    actionStatusEl.style.display = "block";
    BXCore.showToast(message, type);
  };

  const palette = ["#3e3c41", "#2e3b44", "#3c2e44", "#2f3c33", "#3b3232"];
  const getInitials = (name) => {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "--";
    const first = parts[0][0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  };
  const getAvatarColor = (seed) => {
    const str = String(seed || "");
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) % palette.length;
    }
    return palette[hash] || palette[0];
  };
  const formatStatus = (status = "active") => String(status || "active").replace("-", " ");
  const getStatusTone = (status = "active") => {
    const val = String(status || "active");
    if (val === "active") return "status-active";
    if (val === "inactive") return "status-inactive";
    if (val === "blocked") return "status-blocked";
    return "status-archived";
  };

  const openAddClientModal = () => {
    if (!addClientModal) return;
    addClientModal.classList.add("is-open");
    addClientModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  };

  const closeAddClientModal = () => {
    if (!addClientModal) return;
    addClientModal.classList.remove("is-open");
    addClientModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  };

  const getFilteredClients = () => {
    let list = [...clients];
    const query = String(searchInput?.value || "").trim().toLowerCase();
    const status = String(statusFilter?.value || "").trim();
    if (status) {
      list = list.filter((c) => (c.status || "active") === status);
    }
    if (query) {
      list = list.filter((c) => {
        const name = String(c.clientName || "").toLowerCase();
        const username = String(c.username || "").toLowerCase();
        return name.includes(query) || username.includes(query);
      });
    }
    return list;
  };

  const closeAllMenus = () => {
    document.querySelectorAll(".row-menu.is-open").forEach((menu) => {
      menu.classList.remove("is-open");
    });
  };

  /* ---------------------------------------------------------
     RENDER CLIENTS TABLE
  --------------------------------------------------------- */
  function renderClientsTable() {
    if (!clientsTableWrapper) return;
    clientsTableWrapper.innerHTML = "";
    if (clientsCountEl) clientsCountEl.textContent = clients.length;

    const filtered = getFilteredClients();
    if (!filtered.length) {
      clientsTableWrapper.innerHTML = '<div class="empty">No clients found.</div>';
      return;
    }

    const cardsWrap = document.createElement("div");
    cardsWrap.className = "clients-cards";

    filtered.forEach((c) => {
      const clientProjects = projects.filter((p) => p.clientId === c.clientId);
      const clientTasks = tasks.filter((t) =>
        clientProjects.some((p) => p.projectId === t.projectId)
      );
      const displayName = c.clientName || c.username || "Unknown";
      const initials = getInitials(displayName);
      const avatarColor = getAvatarColor(displayName);
      const username = c.username || "Unknown";
      const statusTone = getStatusTone(c.status || "active");
      const joined = BXCore.formatDate(c.createdAt) || "--";

      const card = document.createElement("article");
      card.className = "client-card";
      card.dataset.clientId = c.clientId;
      card.innerHTML = `
        <div class="client-card-top">
          <div class="client-cell">
            <span class="client-avatar" style="--avatar-color: ${avatarColor}">${initials}</span>
            <div class="client-identity">
              <strong>${displayName}</strong>
              <span class="muted">${username}</span>
            </div>
          </div>
          <div class="client-card-actions">
            <span class="status-pill ${statusTone}">
              <span class="status-dot"></span>${formatStatus(c.status || "active")}
            </span>
            <div class="row-menu" data-menu="${c.clientId}">
              <button class="menu-trigger" type="button" data-menu-trigger="${c.clientId}" aria-label="Client actions">
                <i class="fas fa-ellipsis"></i>
              </button>
              <div class="menu-dropdown" role="menu">
                <button type="button" class="menu-item" data-action="edit" data-client="${c.clientId}">Edit client</button>
                <button type="button" class="menu-item" data-action="toggle" data-client="${c.clientId}">
                  ${(c.status || "active") === "active" ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="client-card-metrics">
          <div class="client-metric">
            <span>Projects</span>
            <strong>${clientProjects.length}</strong>
          </div>
          <div class="client-metric">
            <span>Tasks</span>
            <strong>${clientTasks.length}</strong>
          </div>
          <div class="client-metric">
            <span>Joined</span>
            <strong>${joined}</strong>
          </div>
        </div>
      `;
      cardsWrap.appendChild(card);
    });

    clientsTableWrapper.appendChild(cardsWrap);
  }

  async function renderClients() {
    if (!clientsTableWrapper) return;
    BXCore.renderSkeleton(clientsTableWrapper, "table", 1);

    try {
      data = await BXCore.apiGetAll();
      BXCore.updateSidebarStats(data);
    } catch (err) {
      console.error(err);
      clientsTableWrapper.innerHTML =
        '<div class="empty">We could not load clients. Please refresh and try again.</div>';
      showActionStatus("We could not load clients. Please refresh and try again.", "error");
      return;
    }

    clients = BXCore.validateClientsSchema(data.clients || []);
    projects = data.projects || [];
    tasks = data.tasks || [];

    renderClientsTable();
  }

  function renderClientDetail(client, clientProjects, clientTasks, options = {}) {
    if (!detailModal || !detailBody) return;
    if (!client) return;

    const completed = clientTasks.filter((t) => t.status === "completed").length;
    const inProgress = clientTasks.filter((t) => t.status === "in-progress").length;
    const blocked = clientTasks.filter((t) => t.status === "blocked").length;
    const clientStatus = client.status || "active";

    if (detailTitle) detailTitle.textContent = client.clientName || client.username || "Client";
    if (detailSubtitle)
      detailSubtitle.textContent = `${clientProjects.length} projects, ${clientTasks.length} tasks total.`;

    detailBody.innerHTML = `
      <div class="client-summary-grid">
        <div class="client-summary-card">
          <span>Projects</span>
          <strong>${clientProjects.length}</strong>
        </div>
        <div class="client-summary-card">
          <span>Tasks</span>
          <strong>${clientTasks.length}</strong>
        </div>
        <div class="client-summary-card">
          <span>In progress</span>
          <strong>${inProgress}</strong>
        </div>
        <div class="client-summary-card">
          <span>Completed</span>
          <strong>${completed}</strong>
        </div>
        <div class="client-summary-card">
          <span>Blocked</span>
          <strong>${blocked}</strong>
        </div>
        <div class="client-summary-card">
          <span>Status</span>
          <strong>${clientStatus}</strong>
        </div>
      </div>
      <div class="client-admin">
        <div class="client-admin-header">
          <div>
            <h3>Client access</h3>
            <p class="helper">Update name, login, or status. Leave password blank to keep it.</p>
          </div>
          <button type="button" class="btn-danger btn-compact" data-client-delete="${client.clientId}">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
        <div id="clientEditStatus" class="alert alert-info" style="display:none"></div>
        <form id="clientEditForm" class="form-grid" data-client-id="${client.clientId}">
          <div class="client-admin-grid">
            <div class="form-row">
              <label for="editClientName">Client name</label>
              <input id="editClientName" name="clientName" value="${client.clientName || ""}" required />
            </div>
            <div class="form-row">
              <label for="editClientUsername">Username</label>
              <input id="editClientUsername" name="username" value="${client.username || ""}" required />
            </div>
            <div class="form-row">
              <label for="editClientPassword">Password</label>
              <input id="editClientPassword" name="password" type="password" value="" placeholder="Leave blank to keep current" />
            </div>
            <div class="form-row">
              <label for="editClientStatus">Status</label>
              <select id="editClientStatus" name="status">
                <option value="active" ${clientStatus === "active" ? "selected" : ""}>Active</option>
                <option value="inactive" ${clientStatus === "inactive" ? "selected" : ""}>Inactive</option>
                <option value="blocked" ${clientStatus === "blocked" ? "selected" : ""}>Blocked</option>
                <option value="archived" ${clientStatus === "archived" ? "selected" : ""}>Archived</option>
              </select>
            </div>
          </div>
          <div class="client-admin-actions">
            <button type="submit" class="btn-primary btn-compact">
              <i class="fas fa-save"></i> Save changes
            </button>
          </div>
        </form>
      </div>
    `;

    detailModal.classList.add("is-open");
    detailModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    if (options.focusEdit) {
      const focusInput = detailBody.querySelector("#editClientName");
      if (focusInput) setTimeout(() => focusInput.focus(), 0);
    }
  }

  function closeDetailModal() {
    if (!detailModal) return;
    detailModal.classList.remove("is-open");
    detailModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  /* ---------------------------------------------------------
     ADD CLIENT HANDLER
  --------------------------------------------------------- */
  const addClientForm = document.getElementById("addClientForm");
  if (addClientForm) addClientForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (statusEl) statusEl.style.display = "none";
    const submitBtn = e.target.querySelector("button[type=\"submit\"]");

    const fd = new FormData(e.target);

    const clientName = String(fd.get("clientName") || "").trim();
    const username = String(fd.get("username") || "").trim();
    const password = String(fd.get("password") || "").trim();

    if (!clientName || !username || !password) {
      showActionStatus("Please complete all fields to add a client.", "error");
      return;
    }
    BXCore.setButtonLoading(submitBtn, true, "Saving...");

    const clientId = "client_" + Date.now();

    try {
      const resp = await BXCore.apiPost({
        action: "addClient",
        clientId,
        clientName,
        username,
        password,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (!resp.ok) throw new Error(resp.error || "Create failed");

      e.target.reset();

      if (statusEl) {
        statusEl.textContent = "Client added successfully.";
        statusEl.style.display = "block";
        setTimeout(() => (statusEl.style.display = "none"), 2000);
      }
      showActionStatus("Client added. You can assign projects now.", "success");
      closeAddClientModal();

      // Refresh sidebar counters
      const fresh = await BXCore.apiGetAll(true);
      BXCore.updateSidebarStats(fresh);

      // Refresh table
      await renderClients();
    } catch (err) {
      console.error(err);
      showActionStatus("Couldn't add the client. Please try again.", "error");
    } finally {
      BXCore.setButtonLoading(submitBtn, false);
    }
  });

  /* ---------------------------------------------------------
     INITIAL LOAD
  --------------------------------------------------------- */
  if (addClientBtn) addClientBtn.addEventListener("click", openAddClientModal);
  if (addClientModalClose) addClientModalClose.addEventListener("click", closeAddClientModal);
  if (addClientModal) {
    const backdrop = addClientModal.querySelector(".modal-backdrop");
    if (backdrop) backdrop.addEventListener("click", closeAddClientModal);
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (addClientModal?.classList.contains("is-open")) closeAddClientModal();
  });

  [searchInput, statusFilter].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", renderClientsTable);
    el.addEventListener("change", renderClientsTable);
  });

  renderClients();

  if (detailClose && detailModal) {
    detailClose.addEventListener("click", closeDetailModal);
    const backdrop = detailModal.querySelector(".modal-backdrop");
    if (backdrop) backdrop.addEventListener("click", closeDetailModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && detailModal.classList.contains("is-open")) closeDetailModal();
    });
  }

  if (detailModal && !modalActionsBound) {
    modalActionsBound = true;
    detailModal.addEventListener("click", async (e) => {
      const deleteBtn = e.target.closest("button[data-client-delete]");
      if (!deleteBtn) return;
      const clientId = deleteBtn.getAttribute("data-client-delete");
      if (!clientId) return;

      const confirmDelete = await BXCore.confirmAction({
        title: "Delete client?",
        message: "Projects and tasks will remain but may become orphaned.",
        confirmLabel: "Delete client",
        tone: "danger",
      });
      if (!confirmDelete) return;

      BXCore.setButtonLoading(deleteBtn, true, "Deleting...");
      try {
        const resp = await BXCore.apiPost({
          action: "deleteClient",
          clientId,
        });
        if (!resp.ok) throw new Error(resp.error || "Delete failed");
        data = await BXCore.apiGetAll(true);
        BXCore.updateSidebarStats(data);
        clients = BXCore.validateClientsSchema(data.clients || []);
        projects = data.projects || [];
        tasks = data.tasks || [];
        await renderClients();
        closeDetailModal();
        showActionStatus("Client deleted.", "success");
      } catch (err) {
        console.error(err);
        showActionStatus("Couldn't delete the client. Please try again.", "error");
      } finally {
        BXCore.setButtonLoading(deleteBtn, false);
      }
    });

    detailModal.addEventListener("submit", async (e) => {
      const form = e.target.closest("#clientEditForm");
      if (!form) return;
      e.preventDefault();

      const statusEl = form.querySelector("#clientEditStatus");
      if (statusEl) statusEl.style.display = "none";
      const submitBtn = form.querySelector("button[type=\"submit\"]");

      const fd = new FormData(form);
      const clientId = form.dataset.clientId;
      const clientName = String(fd.get("clientName") || "").trim();
      const username = String(fd.get("username") || "").trim();
      const passwordRaw = String(fd.get("password") || "").trim();
      const password = passwordRaw ? passwordRaw : undefined;
      const status = String(fd.get("status") || "active").trim();

      if (!clientName || !username) {
        if (statusEl) {
          statusEl.className = "alert alert-error";
          statusEl.textContent = "Client name and username are required.";
          statusEl.style.display = "block";
        }
        return;
      }

      BXCore.setButtonLoading(submitBtn, true, "Saving...");
      try {
        const resp = await BXCore.apiPost({
          action: "updateClient",
          clientId,
          clientName,
          username,
          password,
          status,
          updatedAt: new Date().toISOString(),
        });
        if (!resp.ok) throw new Error(resp.error || "Update failed");
        data = await BXCore.apiGetAll(true);
        BXCore.updateSidebarStats(data);
        clients = BXCore.validateClientsSchema(data.clients || []);
        projects = data.projects || [];
        tasks = data.tasks || [];
        await renderClients();
        if (statusEl) {
          statusEl.className = "alert alert-success";
          statusEl.textContent = "Client updated successfully.";
          statusEl.style.display = "block";
        }
        BXCore.showToast("Client updated successfully.", "success");
      } catch (err) {
        console.error(err);
        if (statusEl) {
          statusEl.className = "alert alert-error";
          statusEl.textContent = "Couldn't update the client. Please try again.";
          statusEl.style.display = "block";
        }
        BXCore.showToast("Couldn't update the client. Please try again.", "error");
      } finally {
        BXCore.setButtonLoading(submitBtn, false);
      }
    });
  }

  if (clientsTableWrapper && !actionsBound) {
    actionsBound = true;
    clientsTableWrapper.addEventListener("click", async (e) => {
      const menuTrigger = e.target.closest("[data-menu-trigger]");
      if (menuTrigger) {
        const menuId = menuTrigger.getAttribute("data-menu-trigger");
        const menu = clientsTableWrapper.querySelector(`.row-menu[data-menu="${menuId}"]`);
        if (!menu) return;
        const isOpen = menu.classList.contains("is-open");
        closeAllMenus();
        if (!isOpen) menu.classList.add("is-open");
        return;
      }

      const menuItem = e.target.closest(".menu-item");
      if (menuItem) {
        const action = menuItem.getAttribute("data-action");
        const clientId = menuItem.getAttribute("data-client");
        if (!clientId) return;
        const client = clients.find((c) => c.clientId === clientId);
        const clientProjects = projects.filter((p) => p.clientId === clientId);
        const clientTasks = tasks.filter((t) =>
          clientProjects.some((p) => p.projectId === t.projectId)
        );

        if (action === "edit") {
          renderClientDetail(client, clientProjects, clientTasks, { focusEdit: true });
        } else if (action === "toggle" && client) {
          const nextStatus = (client.status || "active") === "active" ? "inactive" : "active";
          try {
            const resp = await BXCore.apiPost({
              action: "updateClient",
              clientId: client.clientId,
              clientName: client.clientName,
              username: client.username,
              status: nextStatus,
              updatedAt: new Date().toISOString(),
            });
            if (!resp.ok) throw new Error(resp.error || "Update failed");
            data = await BXCore.apiGetAll(true);
            BXCore.updateSidebarStats(data);
            clients = BXCore.validateClientsSchema(data.clients || []);
            projects = data.projects || [];
            tasks = data.tasks || [];
            renderClientsTable();
            showActionStatus(`Client ${nextStatus}.`, "success");
          } catch (err) {
            console.error(err);
            showActionStatus("Couldn't update the client. Please try again.", "error");
          }
        }
        closeAllMenus();
      }
    });

    document.addEventListener("click", (e) => {
      if (e.target.closest(".row-menu")) return;
      closeAllMenus();
    });
  }
});
