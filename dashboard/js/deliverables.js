document.addEventListener("DOMContentLoaded", async () => {
  const sess = BXCore.requireAuth({ role: "admin" });
  if (!sess) return;

  const deliverablesGrid = document.getElementById("deliverablesGrid");
  const clientSelect = document.getElementById("deliverablesClientSelect");
  const projectSelect = document.getElementById("deliverablesProjectSelect");
  const statusFilter = document.getElementById("deliverablesStatusFilter");
  const addForm = document.getElementById("addDeliverableForm");
  const addClientSelect = document.getElementById("addDeliverableClientSelect");
  const addProjectSelect = document.getElementById("addDeliverableProjectSelect");
  const addCoverUrlInput = document.getElementById("addDeliverableCoverUrl");
  const addStatusEl = document.getElementById("addDeliverableStatus");
  const addVisibleInput = document.getElementById("addDeliverableVisible");
  const addDeliveryLinkInput = document.getElementById("addDeliverableLink");
  const actionStatusEl = document.getElementById("deliverablesActionStatus");
  const addDeliverableModal = document.getElementById("addDeliverableModal");
  const openAddDeliverableInline = document.getElementById("openAddDeliverableInline");

  const modal = document.getElementById("deliverableModal");
  const modalTitle = document.getElementById("deliverableModalTitle");
  const modalProject = document.getElementById("deliverableModalProject");
  const modalClient = document.getElementById("deliverableModalClient");
  const modalStatus = document.getElementById("deliverableModalStatus");
  const modalUpdated = document.getElementById("deliverableModalUpdated");
  const modalCover = document.getElementById("deliverableModalCover");
  const modalDescription = document.getElementById("deliverableModalDescription");
  const modalLinks = document.getElementById("deliverableModalLinks");
  const modalAdmin = document.getElementById("deliverableModalAdmin");
  const editForm = document.getElementById("deliverableEditForm");
  const editClientSelect = document.getElementById("editDeliverableClientSelect");
  const editProjectSelect = document.getElementById("editDeliverableProjectSelect");
  const editName = document.getElementById("editDeliverableName");
  const editStatus = document.getElementById("editDeliverableStatus");
  const editCover = document.getElementById("editDeliverableCover");
  const editDescription = document.getElementById("editDeliverableDescription");
  const editDeliveryLink = document.getElementById("editDeliverableLink");
  const editVisibleInput = document.getElementById("editDeliverableVisible");
  const editStatusEl = document.getElementById("deliverableEditStatus");

  const showActionStatus = (message, type = "success") => {
    if (!actionStatusEl) return;
    actionStatusEl.classList.remove("alert-success", "alert-error", "alert-info");
    actionStatusEl.classList.add(`alert-${type}`);
    actionStatusEl.textContent = message;
    actionStatusEl.style.display = "block";
    BXCore.showToast(message, type);
    setTimeout(() => {
      actionStatusEl.style.display = "none";
    }, 2200);
  };

  const ALLOWED_DELIVERABLE_STATUSES = [
    "not-started",
    "in-progress",
    "delivered",
    "approved",
  ];

  const showEditStatus = (message, type = "success") => {
    if (!editStatusEl) return;
    editStatusEl.classList.remove("alert-success", "alert-error", "alert-info");
    editStatusEl.classList.add(`alert-${type}`);
    editStatusEl.textContent = message;
    editStatusEl.style.display = "block";
    BXCore.showToast(message, type);
  };

  const resolveCoverImage = async (urlInput, fallbackValue = "") => {
    const url = urlInput?.value?.trim() || "";
    return url || fallbackValue || "";
  };

  const renderSkeletons = (count = 6) => {
    deliverablesGrid.innerHTML = "";
    for (let i = 0; i < count; i += 1) {
      const card = document.createElement("div");
      card.className = "deliverable-card deliverable-skeleton";
      card.innerHTML = `
        <div class="deliverable-cover skeleton"></div>
        <div class="deliverable-body">
          <div class="skeleton skeleton-line" style="width:70%"></div>
          <div class="skeleton skeleton-line" style="width:50%"></div>
          <div class="skeleton skeleton-line" style="width:40%"></div>
        </div>
      `;
      deliverablesGrid.appendChild(card);
    }
  };

  renderSkeletons();

  let data;
  try {
    data = await BXCore.apiGetAll();
    BXCore.updateSidebarStats(data);
  } catch (err) {
    console.error(err);
    deliverablesGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fas fa-circle-exclamation"></i></div>
        <div>
          <h3>We could not load deliverables</h3>
          <p>Something went wrong while loading deliverables.</p>
          <p class="empty-hint">Next step: refresh the page and try again.</p>
        </div>
      </div>
    `;
    showActionStatus("We could not load deliverables. Please refresh and try again.", "error");
    return;
  }

  let clients = data.clients || [];
  let projects = data.projects || [];
  let deliverables = data.deliverables || [];
  let currentDeliverable = null;
  const quickProjectId = new URLSearchParams(window.location.search).get("projectId");

  const getClientName = (clientId) => {
    const client = clients.find((c) => c.clientId === clientId);
    return client?.clientName || client?.username || "Unknown client";
  };

  const getProject = (projectId) => projects.find((p) => p.projectId === projectId);

  const getProjectName = (projectId) => {
    const project = getProject(projectId);
    return project?.name || "Unknown project";
  };

  const getProjectsForClient = (clientId) => {
    if (!clientId || clientId === "all") return projects.slice();
    return projects.filter((p) => p.clientId === clientId);
  };

  const buildSelectOptions = (selectEl, options, placeholder) => {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    if (placeholder) {
      const opt = document.createElement("option");
      if (typeof placeholder === "string") {
        opt.value = "all";
        opt.textContent = placeholder;
      } else {
        opt.value = placeholder.value ?? "all";
        opt.textContent = placeholder.label ?? "";
      }
      selectEl.appendChild(opt);
    }
    options.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.value;
      opt.textContent = item.label;
      selectEl.appendChild(opt);
    });
  };

  const populateClientSelects = () => {
    const options = clients.map((c) => ({
      value: c.clientId,
      label: c.clientName || c.username || c.clientId,
    }));
    buildSelectOptions(clientSelect, options, { value: "all", label: "All clients" });
    buildSelectOptions(addClientSelect, options, { value: "", label: "Select client" });
    buildSelectOptions(editClientSelect, options, { value: "", label: "Select client" });
  };

  const populateProjectSelect = (selectEl, clientId, placeholder, selectedValue, options = {}) => {
    const allowAll = options.allowAll !== false;
    let visibleProjects = getProjectsForClient(clientId);
    if (!allowAll && (!clientId || clientId === "all")) {
      visibleProjects = [];
    }
    const projectOptions = visibleProjects.map((p) => ({
      value: p.projectId,
      label: p.name || p.projectId,
    }));
    buildSelectOptions(selectEl, projectOptions, placeholder);
    if (selectEl) {
      const shouldDisable = !allowAll && (!clientId || clientId === "all" || !visibleProjects.length);
      selectEl.disabled = shouldDisable;
    }
    if (selectedValue) {
      selectEl.value = selectedValue;
    }
  };

  const updateAddProjectSelect = (selectedProjectId) => {
    const clientId = addClientSelect ? addClientSelect.value : "";
    const label = clientId ? "Select project" : "Select client first";
    populateProjectSelect(addProjectSelect, clientId, { value: "", label }, selectedProjectId, { allowAll: false });
  };

  const updateEditProjectSelect = (selectedProjectId) => {
    const clientId = editClientSelect ? editClientSelect.value : "";
    const label = clientId ? "Select project" : "Select client first";
    populateProjectSelect(editProjectSelect, clientId, { value: "", label }, selectedProjectId, { allowAll: false });
  };

  const ensureProjectClientMatch = (projectId, clientId) => {
    const project = getProject(projectId);
    if (!project) return false;
    if (!clientId) return true;
    return project.clientId === clientId;
  };

  const normalizeStatus = (status) => {
    const val = String(status || "").trim().toLowerCase();
    if (val === "ready") return "in-progress";
    if (val === "archived") return "not-started";
    return ALLOWED_DELIVERABLE_STATUSES.includes(val) ? val : "not-started";
  };

  const getDeliverableDisplayStatus = (status) => normalizeStatus(status);

  const formatStatusLabel = (status) =>
    String(status || "not-started").replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const openAddModal = () => {
    if (!addDeliverableModal) return;
    addDeliverableModal.classList.add("is-open");
    addDeliverableModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  };

  const closeAddModal = () => {
    if (!addDeliverableModal) return;
    addDeliverableModal.classList.remove("is-open");
    addDeliverableModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (addStatusEl) addStatusEl.style.display = "none";
  };

  const openModal = (deliverable) => {
    if (!deliverable) return;
    currentDeliverable = deliverable;
    const project = getProject(deliverable.projectId);
    const clientId = deliverable.clientId || project?.clientId || "";
    const statusValue = normalizeStatus(deliverable.status);
    modalTitle.textContent = deliverable.name || "Deliverable";
    modalProject.textContent = `Project: ${project?.name || "Unknown project"}`;
    modalClient.textContent = `Client: ${getClientName(clientId)}`;
    modalStatus.textContent = statusValue.replace("-", " ");
    modalStatus.className = `badge ${statusValue}`;
    modalUpdated.textContent = deliverable.updatedAt
      ? `Updated ${BXCore.formatDateTime(deliverable.updatedAt)}`
      : "Updated recently";
    modalDescription.textContent = deliverable.description || "No description provided yet.";

    const coverUrl = deliverable.coverImage || "";
    if (coverUrl) {
      modalCover.style.backgroundImage = `url("${coverUrl}")`;
      modalCover.classList.remove("is-empty");
    } else {
      modalCover.style.backgroundImage = "";
      modalCover.classList.add("is-empty");
    }

    modalLinks.innerHTML = "";
    const deliveryUrl = deliverable.deliveryLink || deliverable.downloadLink || deliverable.previewLink || deliverable.driveLink;
    const linkEl = document.createElement(deliveryUrl ? "a" : "div");
    linkEl.className = `modal-link${deliveryUrl ? "" : " is-empty"}`;
    if (deliveryUrl) {
      linkEl.href = deliveryUrl;
      linkEl.target = "_blank";
      linkEl.rel = "noopener";
      linkEl.innerHTML = `<i class="fas fa-link"></i> Open deliverable`;
    } else {
      linkEl.innerHTML = `<i class="fas fa-link"></i> Deliverable link not available`;
    }
    modalLinks.appendChild(linkEl);

    if (modalAdmin) {
      modalAdmin.style.display = "block";
    }

    if (editForm) {
      editName.value = deliverable.name || "";
      editStatus.value = statusValue;
      editCover.value = deliverable.coverImage || "";
      editDescription.value = deliverable.description || "";
      editDeliveryLink.value =
        deliverable.deliveryLink || deliverable.downloadLink || deliverable.previewLink || deliverable.driveLink || "";
      if (editVisibleInput) {
        editVisibleInput.checked = deliverable.visibleToClient === true || String(deliverable.visibleToClient) === "true";
      }
      editClientSelect.value = clientId || "";
          updateEditProjectSelect(deliverable.projectId);
    }

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  };

  const closeModal = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    currentDeliverable = null;
    if (editStatusEl) editStatusEl.style.display = "none";
  };

  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-modal-close]")) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });

  if (openAddDeliverableInline) {
    openAddDeliverableInline.addEventListener("click", openAddModal);
  }

  if (addDeliverableModal) {
    addDeliverableModal.addEventListener("click", (e) => {
      if (e.target.closest("[data-modal-close]")) {
        closeAddModal();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && addDeliverableModal?.classList.contains("is-open")) {
      closeAddModal();
    }
  });

  const storageKey = `bxm_deliverables_${sess.username || sess.client_id || sess.clientId || "user"}`;
  const collapsedProjectsKey = `${storageKey}_collapsed_projects`;
  const collapsedProjectIds = new Set(
    JSON.parse(localStorage.getItem(collapsedProjectsKey) || "[]")
  );

  const persistCollapsedProjects = () => {
    localStorage.setItem(collapsedProjectsKey, JSON.stringify([...collapsedProjectIds]));
  };

  const renderDeliverables = () => {
    deliverablesGrid.innerHTML = "";

    const selectedClient = clientSelect.value;
    const selectedProject = projectSelect.value;
    const selectedStatus = statusFilter.value;

    let filtered = deliverables.slice();
    if (selectedClient !== "all") {
      filtered = filtered.filter((d) => {
        const project = getProject(d.projectId);
        const clientId = d.clientId || project?.clientId;
        return clientId === selectedClient;
      });
    }
    if (selectedProject !== "all") {
      filtered = filtered.filter((d) => d.projectId === selectedProject);
    }
    if (selectedStatus !== "all") {
      filtered = filtered.filter((d) => normalizeStatus(d.status) === selectedStatus);
    }

    if (!filtered.length) {
      deliverablesGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-box-open"></i></div>
          <div>
            <h3>No deliverables yet</h3>
            <p>Track your first delivery to keep assets organized.</p>
            <button class="btn-primary" type="button" id="emptyAddDeliverable">
              <i class="fas fa-plus"></i> Add first deliverable
            </button>
          </div>
        </div>
      `;
      const addBtn = document.getElementById("emptyAddDeliverable");
      if (addBtn) addBtn.addEventListener("click", openAddModal);
      return;
    }

    const grouped = new Map();
    filtered.forEach((d) => {
      if (!grouped.has(d.projectId)) grouped.set(d.projectId, []);
      grouped.get(d.projectId).push(d);
    });

    grouped.forEach((items, projectId) => {
      const project = getProject(projectId);
      const projectLabel = project?.name || "Unknown project";
      const isCollapsed = collapsedProjectIds.has(projectId);
      const section = document.createElement("section");
      section.className = "deliverables-project";
      section.dataset.projectId = projectId;
      section.innerHTML = `
        <button class="deliverables-project-header" type="button" data-project-id="${projectId}" aria-expanded="${!isCollapsed}">
          <div>
            <h3>${projectLabel}</h3>
            <span class="deliverables-project-meta">${items.length} deliverables</span>
          </div>
          <i class="fas fa-chevron-${isCollapsed ? "right" : "down"}"></i>
        </button>
        <div class="deliverables-project-body ${isCollapsed ? "is-collapsed" : ""}">
          <div class="deliverables-list"></div>
        </div>
      `;
      const list = section.querySelector(".deliverables-list");
      items
        .slice()
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
        .forEach((d) => {
          const clientId = d.clientId || project?.clientId;
          const statusValue = getDeliverableDisplayStatus(d.status);
          const updatedLabel = d.updatedAt ? BXCore.formatDateTime(d.updatedAt) : "Updated recently";
          const row = document.createElement("div");
          row.className = "deliverable-row";
          row.dataset.deliverableId = d.deliverableId;
          row.innerHTML = `
            <div class="deliverable-row-main">
              <div class="deliverable-thumb ${d.coverImage ? "" : "is-empty"}" style="${
                d.coverImage ? `background-image:url('${d.coverImage}')` : ""
              }"></div>
              <div class="deliverable-info">
                <div class="deliverable-title">${d.name || "Untitled deliverable"}</div>
                <div class="deliverable-meta">
                  <span class="deliverable-status ${statusValue}">${formatStatusLabel(statusValue)}</span>
                  <span class="deliverable-updated">${updatedLabel}</span>
                </div>
              </div>
            </div>
            <div class="deliverable-actions">
              <button class="btn-secondary btn-compact" type="button" data-action="view">View</button>
              <button class="btn-secondary btn-compact" type="button" data-action="edit">Edit</button>
              <button class="btn-secondary btn-compact" type="button" data-action="replace">Replace</button>
              ${
                d.deliveryLink
                  ? `<a class="ghost btn-compact" href="${d.deliveryLink}" target="_blank" rel="noopener">Download</a>`
                  : ""
              }
            </div>
          `;
          list.appendChild(row);
        });
      deliverablesGrid.appendChild(section);
    });
  };

  deliverablesGrid.addEventListener("click", async (e) => {
    const projectToggle = e.target.closest(".deliverables-project-header");
    if (projectToggle) {
      const projectId = projectToggle.dataset.projectId;
      const body = projectToggle.parentElement?.querySelector(".deliverables-project-body");
      const isCollapsed = body?.classList.toggle("is-collapsed");
      const icon = projectToggle.querySelector("i");
      if (icon) icon.className = `fas fa-chevron-${isCollapsed ? "right" : "down"}`;
      projectToggle.setAttribute("aria-expanded", String(!isCollapsed));
      if (isCollapsed) {
        collapsedProjectIds.add(projectId);
      } else {
        collapsedProjectIds.delete(projectId);
      }
      persistCollapsedProjects();
      return;
    }

    const row = e.target.closest(".deliverable-row");
    if (!row) return;
    const deliverableId = row.dataset.deliverableId;
    const deliverable = deliverables.find((d) => d.deliverableId === deliverableId);
    if (!deliverable) return;

    const actionBtn = e.target.closest("[data-action]");
    if (actionBtn) {
      const action = actionBtn.dataset.action;
      if (action === "view") {
        openModal(deliverable);
        return;
      }
      if (action === "edit") {
        openModal(deliverable);
        return;
      }
      if (action === "replace") {
        openModal(deliverable);
        setTimeout(() => editDeliveryLink?.focus(), 0);
        return;
      }
    }
  });

  clientSelect.addEventListener("change", () => {
    populateProjectSelect(projectSelect, clientSelect.value, { value: "all", label: "All projects" });
    renderDeliverables();
  });

  projectSelect.addEventListener("change", renderDeliverables);
  statusFilter.addEventListener("change", renderDeliverables);

  addClientSelect.addEventListener("change", () => {
    updateAddProjectSelect();
  });

  editClientSelect.addEventListener("change", () => {
    updateEditProjectSelect();
  });

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (addStatusEl) addStatusEl.style.display = "none";
    const submitBtn = e.target.querySelector("button[type=\"submit\"]");
    const fd = new FormData(addForm);
    const name = String(fd.get("name") || "").trim();
    const clientId = String(fd.get("clientId") || "").trim();
    const projectId = String(fd.get("projectId") || "").trim();
    const deliveryLink = String(fd.get("deliveryLink") || "").trim();
    const description = String(fd.get("description") || "").trim();
    if (!name) {
      showActionStatus("Deliverable name is required.", "error");
      return;
    }
    if (!clientId || !projectId) {
      showActionStatus("Please select both a client and a project.", "error");
      return;
    }
    if (!ensureProjectClientMatch(projectId, clientId)) {
      showActionStatus("Selected project does not belong to that client.", "error");
      return;
    }

    BXCore.setButtonLoading(submitBtn, true, "Saving...");
    const deliverableId = "deliverable_" + Date.now();
    try {
      const coverImage = await resolveCoverImage(addCoverUrlInput);
      const resp = await BXCore.apiPost({
        action: "addDeliverable",
        deliverableId,
        clientId,
        clientName: getClientName(clientId),
        projectId,
        projectName: getProjectName(projectId),
        name,
        status: normalizeStatus(fd.get("status") || "in-progress"),
        coverImage,
        coverPhoto: coverImage,
        coverUrl: coverImage,
        description,
        deliveryLink,
        downloadLink: deliveryLink,
        previewLink: deliveryLink,
        driveLink: deliveryLink,
        visibleToClient: addVisibleInput?.checked ? true : false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (!resp.ok) throw new Error(resp.error || "Create failed");
      addForm.reset();
      updateAddProjectSelect();
      if (addCoverUrlInput) addCoverUrlInput.value = "";
      if (addVisibleInput) addVisibleInput.checked = false;
      if (addStatusEl) {
        addStatusEl.textContent = "Deliverable added successfully.";
        addStatusEl.style.display = "block";
        setTimeout(() => (addStatusEl.style.display = "none"), 2000);
      }
      showActionStatus("Deliverable saved. The list is refreshed.", "success");
      closeAddModal();
      data = await BXCore.apiGetAll(true);
      BXCore.updateSidebarStats(data);
      clients = data.clients || [];
      projects = data.projects || [];
      deliverables = data.deliverables || [];
      populateClientSelects();
      populateProjectSelect(projectSelect, clientSelect.value, { value: "all", label: "All projects" });
      updateAddProjectSelect();
      renderDeliverables();
    } catch (err) {
      console.error(err);
      showActionStatus("Couldn't save the deliverable. Please try again.", "error");
    } finally {
      BXCore.setButtonLoading(submitBtn, false);
    }
  });

  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentDeliverable) return;
    if (editStatusEl) editStatusEl.style.display = "none";
    const submitBtn = editForm.querySelector("button[type=\"submit\"]");

    const name = editName.value.trim();
    const clientId = editClientSelect.value;
    const projectId = editProjectSelect.value;
    const deliveryLink = editDeliveryLink.value.trim();
    const description = editDescription.value.trim();
    if (!name) {
      showEditStatus("Deliverable name is required.", "error");
      return;
    }
    if (!ensureProjectClientMatch(projectId, clientId)) {
      showEditStatus("Selected project does not belong to that client.", "error");
      return;
    }

    BXCore.setButtonLoading(submitBtn, true, "Saving...");
    try {
      const coverImage = await resolveCoverImage(editCover, editCover.value);
      const resp = await BXCore.apiPost({
        action: "updateDeliverable",
        deliverableId: currentDeliverable.deliverableId,
        clientId,
        projectId,
        clientName: getClientName(clientId),
        projectName: getProjectName(projectId),
        name,
        status: normalizeStatus(editStatus.value),
        coverImage,
        coverPhoto: coverImage,
        coverUrl: coverImage,
        description,
        deliveryLink,
        downloadLink: deliveryLink,
        previewLink: deliveryLink,
        driveLink: deliveryLink,
        visibleToClient: editVisibleInput?.checked ? true : false,
        updatedAt: new Date().toISOString(),
      });
      if (!resp.ok) throw new Error(resp.error || "Update failed");
      data = await BXCore.apiGetAll(true);
      BXCore.updateSidebarStats(data);
      clients = data.clients || [];
      projects = data.projects || [];
      deliverables = data.deliverables || [];
      populateClientSelects();
      populateProjectSelect(projectSelect, clientSelect.value, { value: "all", label: "All projects" });
      updateAddProjectSelect();
      renderDeliverables();
      showEditStatus("Deliverable updated successfully.", "success");
      closeModal();
      showActionStatus("Deliverable updated successfully.", "success");
    } catch (err) {
      console.error(err);
      showEditStatus("Couldn't update the deliverable. Please try again.", "error");
    } finally {
      BXCore.setButtonLoading(submitBtn, false);
    }
  });

  populateClientSelects();
  populateProjectSelect(projectSelect, clientSelect.value, { value: "all", label: "All projects" });
  updateAddProjectSelect();

  if (quickProjectId) {
    const quickProject = projects.find((p) => p.projectId === quickProjectId);
    if (quickProject) {
      addClientSelect.value = quickProject.clientId;
      updateAddProjectSelect(quickProjectId);
      openAddModal();
    }
  }

  renderDeliverables();
});
