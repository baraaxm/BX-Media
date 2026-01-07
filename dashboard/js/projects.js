
document.addEventListener("DOMContentLoaded", async () => {
  const sess = BXCore.requireAuth({ role: "admin" });
  if (!sess) return;

  const clientFilterRow = document.getElementById("projectsClientRow");
  const clientFilterSelect = document.getElementById("projectsClientSelect");
  const statusFilter = document.getElementById("projectsStatusFilter");
  const addProjectClientSelect = document.getElementById("addProjectClientSelect");
  const projectsList = document.getElementById("projectsList");
  const statusBox = document.getElementById("addProjectStatus");
  const actionStatusEl = document.getElementById("projectsActionStatus");
  const toggleAddProjectBtn = document.getElementById("toggleAddProject");
  const addProjectPanel = document.getElementById("addProjectPanel");
  const openAddProjectInline = document.getElementById("openAddProjectInline");
  const cancelAddProjectBtn = document.getElementById("cancelAddProject");
  const quickTaskModal = document.getElementById("quickTaskModal");
  const quickTaskMeta = document.getElementById("quickTaskMeta");
  const quickTaskForm = document.getElementById("quickTaskForm");
  const quickTaskProjectId = document.getElementById("quickTaskProjectId");
  const quickTaskTitle = document.getElementById("quickTaskTitle");
  const quickTaskDescription = document.getElementById("quickTaskDescription");
  const quickTaskAssignee = document.getElementById("quickTaskAssignee");
  const quickTaskStatus = document.getElementById("quickTaskStatus");
  const quickTaskProgress = document.getElementById("quickTaskProgress");
  const quickTaskDueDate = document.getElementById("quickTaskDueDate");
  const quickDeliverableModal = document.getElementById("quickDeliverableModal");
  const quickDeliverableMeta = document.getElementById("quickDeliverableMeta");
  const quickDeliverableForm = document.getElementById("quickDeliverableForm");
  const quickDeliverableProjectId = document.getElementById("quickDeliverableProjectId");
  const quickDeliverableClientId = document.getElementById("quickDeliverableClientId");
  const quickDeliverableName = document.getElementById("quickDeliverableName");
  const quickDeliverableStatus = document.getElementById("quickDeliverableStatus");
  const quickDeliverableCover = document.getElementById("quickDeliverableCover");
  const quickDeliverableDescription = document.getElementById("quickDeliverableDescription");
  const quickDeliverableLink = document.getElementById("quickDeliverableLink");
  const quickDeliverableVisible = document.getElementById("quickDeliverableVisible");
  const projectEditModal = document.getElementById("projectEditModal");
  const projectEditMeta = document.getElementById("projectEditMeta");
  const projectEditForm = document.getElementById("projectEditForm");
  const projectEditName = document.getElementById("projectEditName");
  const projectEditDescription = document.getElementById("projectEditDescription");
  const projectEditStatus = document.getElementById("projectEditStatus");
  const projectEditClient = document.getElementById("projectEditClient");
  const projectEditDrive = document.getElementById("projectEditDrive");
  const projectEditDate = document.getElementById("projectEditDate");
  const projectEditDelete = document.getElementById("projectEditDelete");

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

  BXCore.renderSkeleton(projectsList, "card", 3);

  let data;
  try {
    data = await BXCore.apiGetAll();
    BXCore.updateSidebarStats(data);
  } catch (err) {
    console.error(err);
    projectsList.innerHTML =
      '<div class="empty">We could not load projects. Please refresh and try again.</div>';
    showActionStatus("We could not load projects. Please refresh and try again.", "error");
    return;
  }

  let clients = data.clients || [];
  let projects = data.projects || [];
  let tasks = data.tasks || [];
  let projectActionsBound = false;
  let currentEditProject = null;
  let currentQuickProject = null;

  const openAddProject = () => {
    if (!addProjectPanel) return;
    addProjectPanel.classList.remove("is-collapsed");
    addProjectPanel.setAttribute("aria-hidden", "false");
    if (toggleAddProjectBtn) toggleAddProjectBtn.textContent = "Hide";
    addProjectPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  function populateClientSelects() {
    clientFilterSelect.innerHTML = '<option value="all">All clients</option>';
    addProjectClientSelect.innerHTML = '<option value="">Select client</option>';

    clients.forEach((c) => {
      const opt1 = document.createElement("option");
      opt1.value = c.clientId;
      opt1.textContent = c.clientName || c.username || c.clientId;
      clientFilterSelect.appendChild(opt1);

      const opt2 = opt1.cloneNode(true);
      addProjectClientSelect.appendChild(opt2);
    });
  }

  function buildClientOptions(selectedId) {
    return clients
      .map(
        (c) =>
          `<option value="${c.clientId}" ${c.clientId === selectedId ? "selected" : ""}>${
            c.clientName || c.username || c.clientId
          }</option>`
      )
      .join("");
  }

  function getProjectDisplayName(project) {
    if (!project) return "";
    return project.name || project.projectName || project.title || project.projectId || "";
  }

  function openProjectModal(project) {
    if (!projectEditModal || !projectEditForm) return;
    currentEditProject = project;
    const client = clients.find((c) => c.clientId === project.clientId);
    if (projectEditMeta) {
      projectEditMeta.textContent = client?.clientName || client?.username || "Unknown client";
    }
    if (projectEditName) projectEditName.value = project.name || "";
    if (projectEditDescription) projectEditDescription.value = project.description || "";
    if (projectEditDate) projectEditDate.value = project.projectDate || project.project_date || "";
    if (projectEditStatus) projectEditStatus.value = project.status || "not-started";
    if (projectEditClient) projectEditClient.innerHTML = buildClientOptions(project.clientId);
    if (projectEditDrive) projectEditDrive.value = project.driveLink || "";

    projectEditModal.classList.add("is-open");
    projectEditModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeProjectModal() {
    if (!projectEditModal) return;
    projectEditModal.classList.remove("is-open");
    projectEditModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    currentEditProject = null;
  }

  function openQuickTaskModal(project) {
    if (!quickTaskModal || !quickTaskForm) return;
    currentQuickProject = project;
    const client = clients.find((c) => c.clientId === project.clientId);
    if (quickTaskMeta) {
      const projectLabel = getProjectDisplayName(project) || "Unknown project";
      const clientLabel = client?.clientName || client?.username || "Unknown client";
      quickTaskMeta.textContent = `${projectLabel} \u2022 ${clientLabel}`;
    }
    if (quickTaskProjectId) quickTaskProjectId.value = project.projectId;
    if (quickTaskTitle) quickTaskTitle.value = "";
    if (quickTaskDescription) quickTaskDescription.value = "";
    if (quickTaskAssignee) quickTaskAssignee.value = "bx-media";
    if (quickTaskStatus) quickTaskStatus.value = "not-started";
    if (quickTaskProgress) quickTaskProgress.value = 0;
    if (quickTaskDueDate) quickTaskDueDate.value = "";

    quickTaskModal.classList.add("is-open");
    quickTaskModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeQuickTaskModal() {
    if (!quickTaskModal) return;
    quickTaskModal.classList.remove("is-open");
    quickTaskModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    currentQuickProject = null;
  }

  function openQuickDeliverableModal(project) {
    if (!quickDeliverableModal || !quickDeliverableForm) return;
    currentQuickProject = project;
    const client = clients.find((c) => c.clientId === project.clientId);
    if (quickDeliverableMeta) {
      const projectLabel = getProjectDisplayName(project) || "Unknown project";
      const clientLabel = client?.clientName || client?.username || "Unknown client";
      quickDeliverableMeta.textContent = `${projectLabel} \u2022 ${clientLabel}`;
    }
    if (quickDeliverableProjectId) quickDeliverableProjectId.value = project.projectId;
    if (quickDeliverableClientId) quickDeliverableClientId.value = project.clientId;
    if (quickDeliverableName) quickDeliverableName.value = "";
    if (quickDeliverableStatus) quickDeliverableStatus.value = "not-started";
    if (quickDeliverableCover) quickDeliverableCover.value = "";
    if (quickDeliverableDescription) quickDeliverableDescription.value = "";
    if (quickDeliverableLink) quickDeliverableLink.value = "";
    if (quickDeliverableVisible) quickDeliverableVisible.checked = false;

    quickDeliverableModal.classList.add("is-open");
    quickDeliverableModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeQuickDeliverableModal() {
    if (!quickDeliverableModal) return;
    quickDeliverableModal.classList.remove("is-open");
    quickDeliverableModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    currentQuickProject = null;
  }

  function renderProjects() {
    const clientId = clientFilterSelect.value;
    const status = statusFilter.value;

    projectsList.innerHTML = "";
    let filtered = projects.slice();

    if (clientId !== "all") {
      filtered = filtered.filter((p) => p.clientId === clientId);
    }
    if (status !== "all") {
      filtered = filtered.filter((p) => (p.status || "not-started") === status);
    }

    if (!projects.length) {
      projectsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-folder-open"></i></div>
          <div>
            <h3>No projects yet</h3>
            <p>Create the first project to start tracking delivery.</p>
            <button class="btn-primary" type="button" id="emptyAddProject">
              <i class="fas fa-plus"></i> Add project
            </button>
          </div>
        </div>
      `;
      const addBtn = document.getElementById("emptyAddProject");
      if (addBtn) addBtn.addEventListener("click", openAddProject);
      return;
    }

    if (!filtered.length) {
      projectsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-filter"></i></div>
          <div>
            <h3>No projects match the filter</h3>
            <p>Adjust filters or create a new project.</p>
            <button class="btn-secondary" type="button" id="emptyAddProjectFiltered">Add project</button>
          </div>
        </div>
      `;
      const addBtn = document.getElementById("emptyAddProjectFiltered");
      if (addBtn) addBtn.addEventListener("click", openAddProject);
      return;
    }

    filtered.forEach((p) => {
      const pTasks = tasks.filter((t) => t.projectId === p.projectId);
      const progress = BXCore.computeProjectProgress(pTasks);
      const client = clients.find((c) => c.clientId === p.clientId);
      const projectDateRaw = p.projectDate || p.project_date || "";
      const projectDateLabel = projectDateRaw ? BXCore.formatDate(projectDateRaw) : "TBD";
      const card = document.createElement("article");
      card.className = "project-card";
      card.dataset.projectId = p.projectId;
      card.innerHTML = `
        <header>
          <div>
            <h3>${getProjectDisplayName(p) || "Untitled project"}</h3>
            <p class="project-desc">${p.description || ""}</p>
            <p class="project-desc" style="font-size:0.8rem;margin-top:0.2rem;">
              Client: <strong>${client?.clientName || client?.username || "Unknown"}</strong>
            </p>
            <p class="project-desc" style="font-size:0.8rem;margin-top:0.2rem;">
              Project date: <strong>${projectDateLabel}</strong>
            </p>
          </div>
          <div class="project-card-actions">
            <span class="badge ${p.status || "in-progress"}">
              ${(p.status || "in-progress").replace("-", " ")}
            </span>
            <div class="project-actions">
              <button class="btn-secondary btn-compact project-edit-open" type="button">Edit</button>
            </div>
          </div>
        </header>
        <div class="project-meta">
          <div style="flex:1">
            <progress max="100" value="${progress}"></progress>
          </div>
          <span class="progress-label">${progress}%</span>
          ${
            p.driveLink
              ? `<a class="ghost" href="${p.driveLink}" target="_blank" rel="noopener">Drive</a>`
              : ""
          }
        </div>
        <div class="project-desc" style="font-size:0.8rem;margin-top:0.3rem;">
          ${pTasks.length} tasks
        </div>
        <div class="project-actions" style="margin-top:0.4rem;">
          <button class="btn-secondary btn-compact project-quick-task" type="button">
            <i class="fas fa-plus"></i> Add task
          </button>
          <button class="btn-secondary btn-compact project-quick-deliverable" type="button">
            <i class="fas fa-box-open"></i> Add deliverable
          </button>
        </div>
      `;
      projectsList.appendChild(card);
    });

    if (!projectActionsBound) {
      projectActionsBound = true;
      projectsList.addEventListener("click", async (e) => {
        const quickTaskBtn = e.target.closest(".project-quick-task");
        const quickDeliverableBtn = e.target.closest(".project-quick-deliverable");
        if (quickTaskBtn || quickDeliverableBtn) {
          const card = e.target.closest(".project-card");
          if (!card) return;
          const projectId = card.dataset.projectId;
          const project = projects.find((item) => item.projectId === projectId);
          if (!project) return;
          if (quickTaskBtn) {
            openQuickTaskModal(project);
          } else {
            openQuickDeliverableModal(project);
          }
          return;
        }

        const openBtn = e.target.closest(".project-edit-open");
        if (!openBtn) return;
        const card = openBtn.closest(".project-card");
        if (!card) return;
        const projectId = card.dataset.projectId;
        const project = projects.find((item) => item.projectId === projectId);
        if (project) openProjectModal(project);
      });
    }
  }

  clientFilterSelect.addEventListener("change", renderProjects);
  statusFilter.addEventListener("change", renderProjects);

  if (quickTaskModal) {
    quickTaskModal.addEventListener("click", (e) => {
      if (e.target.closest("[data-modal-close]")) {
        closeQuickTaskModal();
      }
    });
  }

  if (quickDeliverableModal) {
    quickDeliverableModal.addEventListener("click", (e) => {
      if (e.target.closest("[data-modal-close]")) {
        closeQuickDeliverableModal();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && quickTaskModal?.classList.contains("is-open")) {
      closeQuickTaskModal();
    }
    if (e.key === "Escape" && quickDeliverableModal?.classList.contains("is-open")) {
      closeQuickDeliverableModal();
    }
  });

  if (quickTaskForm) {
    quickTaskForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentQuickProject) return;
      const submitBtn = quickTaskForm.querySelector("button[type=\"submit\"]");
      const title = quickTaskTitle ? quickTaskTitle.value.trim() : "";
      if (!title) {
        showActionStatus("Task title is required.", "error");
        return;
      }
      const description = quickTaskDescription ? quickTaskDescription.value.trim() : "";
      const assignee = quickTaskAssignee ? quickTaskAssignee.value : "bx-media";
      const status = quickTaskStatus ? quickTaskStatus.value : "not-started";
      const progress = quickTaskProgress ? Number(quickTaskProgress.value || 0) : 0;
      const dueDate =
        quickTaskDueDate && quickTaskDueDate.value ? quickTaskDueDate.value : null;
      const projectTasks = tasks.filter((t) => t.projectId === currentQuickProject.projectId);
      const maxOrder = projectTasks.reduce((max, t) => {
        const val = Number(t.taskOrder);
        return Number.isFinite(val) ? Math.max(max, val) : max;
      }, 0);

      BXCore.setButtonLoading(submitBtn, true, "Saving...");
      const taskId = "task_" + Date.now();
      try {
        const resp = await BXCore.apiPost({
          action: "addTask",
          taskId,
          projectId: currentQuickProject.projectId,
          title,
          description,
          assignee,
          status,
          progress: Number.isFinite(progress) ? progress : 0,
          dueDate,
          taskOrder: maxOrder + 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        if (!resp.ok) throw new Error(resp.error || "Create failed");
        data = await BXCore.apiGetAll(true);
        BXCore.updateSidebarStats(data);
        clients = data.clients || [];
        projects = data.projects || [];
        tasks = data.tasks || [];
        closeQuickTaskModal();
        renderProjects();
        showActionStatus("Task added successfully.", "success");
      } catch (err) {
        console.error(err);
        showActionStatus("Couldn't save the task. Please try again.", "error");
      } finally {
        BXCore.setButtonLoading(submitBtn, false);
      }
    });
  }

  if (quickDeliverableForm) {
    const allowedStatuses = ["not-started", "in-progress", "ready", "delivered", "approved", "archived"];
    quickDeliverableForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentQuickProject) return;
      const submitBtn = quickDeliverableForm.querySelector("button[type=\"submit\"]");
      const name = quickDeliverableName ? quickDeliverableName.value.trim() : "";
      if (!name) {
        showActionStatus("Deliverable name is required.", "error");
        return;
      }
      const status = quickDeliverableStatus ? quickDeliverableStatus.value : "not-started";
      const normalizedStatus = allowedStatuses.includes(status) ? status : "not-started";
      const coverImage = quickDeliverableCover ? quickDeliverableCover.value.trim() : "";
      const description = quickDeliverableDescription ? quickDeliverableDescription.value.trim() : "";
      const deliveryLink = quickDeliverableLink ? quickDeliverableLink.value.trim() : "";
      const visibleToClient = quickDeliverableVisible ? quickDeliverableVisible.checked : false;

      BXCore.setButtonLoading(submitBtn, true, "Saving...");
      const deliverableId = "deliverable_" + Date.now();
      try {
        const resp = await BXCore.apiPost({
          action: "addDeliverable",
          deliverableId,
          clientId: currentQuickProject.clientId,
          projectId: currentQuickProject.projectId,
          projectName: getProjectDisplayName(currentQuickProject) || currentQuickProject.projectId,
          name,
          status: normalizedStatus,
          coverImage,
          coverPhoto: coverImage,
          coverUrl: coverImage,
          description,
          deliveryLink,
          downloadLink: deliveryLink,
          previewLink: deliveryLink,
          driveLink: deliveryLink,
          visibleToClient,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        if (!resp.ok) throw new Error(resp.error || "Create failed");
        data = await BXCore.apiGetAll(true);
        BXCore.updateSidebarStats(data);
        clients = data.clients || [];
        projects = data.projects || [];
        tasks = data.tasks || [];
        closeQuickDeliverableModal();
        renderProjects();
        showActionStatus("Deliverable added successfully.", "success");
      } catch (err) {
        console.error(err);
        showActionStatus("Couldn't save the deliverable. Please try again.", "error");
      } finally {
        BXCore.setButtonLoading(submitBtn, false);
      }
    });
  }

  if (projectEditModal) {
    projectEditModal.addEventListener("click", (e) => {
      if (e.target.closest("[data-modal-close]")) {
        closeProjectModal();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && projectEditModal?.classList.contains("is-open")) {
      closeProjectModal();
    }
  });

  if (projectEditDelete) {
    projectEditDelete.addEventListener("click", async () => {
      if (!currentEditProject) return;
      const confirmDelete = await BXCore.confirmAction({
        title: "Delete project?",
        message: "This will delete the project and all related tasks, deliverables, and updates.",
        confirmLabel: "Delete project",
        tone: "danger",
      });
      if (!confirmDelete) return;
      BXCore.setButtonLoading(projectEditDelete, true, "Deleting...");
      try {
        const resp = await BXCore.apiPost({
          action: "deleteProject",
          projectId: currentEditProject.projectId,
        });
        if (!resp.ok) throw new Error(resp.error || "Delete failed");
        data = await BXCore.apiGetAll(true);
        BXCore.updateSidebarStats(data);
        clients = data.clients || [];
        projects = data.projects || [];
        tasks = data.tasks || [];
        closeProjectModal();
        renderProjects();
        showActionStatus("Project deleted.", "success");
      } catch (err) {
        console.error(err);
        showActionStatus("Couldn't delete the project. Please try again.", "error");
      } finally {
        BXCore.setButtonLoading(projectEditDelete, false);
      }
    });
  }

  if (projectEditForm) {
    projectEditForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentEditProject) return;
      const submitBtn = projectEditForm.querySelector("button[type=\"submit\"]");
      const nextName = projectEditName ? projectEditName.value.trim() : "";
      if (!nextName) {
        showActionStatus("Project name is required.", "error");
        return;
      }
      const nextDescription = projectEditDescription ? projectEditDescription.value.trim() : "";
      const nextProjectDate = projectEditDate && projectEditDate.value ? projectEditDate.value : null;
      const nextStatus = projectEditStatus ? projectEditStatus.value : "not-started";
      const nextClientId = projectEditClient ? projectEditClient.value : currentEditProject.clientId;
      const nextDriveLink = projectEditDrive ? projectEditDrive.value.trim() : "";

      BXCore.setButtonLoading(submitBtn, true, "Saving...");
      try {
        const resp = await BXCore.apiPost({
          action: "updateProject",
          projectId: currentEditProject.projectId,
          name: nextName,
          projectName: nextName,
          title: nextName,
          description: nextDescription,
          projectDate: nextProjectDate,
          status: nextStatus,
          clientId: nextClientId,
          driveLink: nextDriveLink,
          updatedAt: new Date().toISOString(),
        });
        if (!resp.ok) throw new Error(resp.error || "Update failed");
        data = await BXCore.apiGetAll(true);
        BXCore.updateSidebarStats(data);
        clients = data.clients || [];
        projects = data.projects || [];
        tasks = data.tasks || [];
        closeProjectModal();
        renderProjects();
        showActionStatus("Project updated successfully.", "success");
      } catch (err) {
        console.error(err);
        showActionStatus("Couldn't update the project. Please try again.", "error");
      } finally {
        BXCore.setButtonLoading(submitBtn, false);
      }
    });
  }

  if (toggleAddProjectBtn && addProjectPanel) {
    toggleAddProjectBtn.addEventListener("click", () => {
      const isCollapsed = addProjectPanel.classList.toggle("is-collapsed");
      toggleAddProjectBtn.textContent = isCollapsed ? "Show" : "Hide";
      addProjectPanel.setAttribute("aria-hidden", isCollapsed ? "true" : "false");
    });
  }

  if (openAddProjectInline && addProjectPanel) {
    openAddProjectInline.addEventListener("click", () => {
      openAddProject();
    });
  }

  if (cancelAddProjectBtn && addProjectPanel) {
    cancelAddProjectBtn.addEventListener("click", () => {
      addProjectPanel.classList.add("is-collapsed");
      addProjectPanel.setAttribute("aria-hidden", "true");
      toggleAddProjectBtn.textContent = "Show";
    });
  }

  document.getElementById("addProjectForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (statusBox) statusBox.style.display = "none";
    const submitBtn = e.target.querySelector("button[type=\"submit\"]");

    const fd = new FormData(e.target);
    const clientId = fd.get("clientId");
    if (!clientId) {
      showActionStatus("Please select a client before saving the project.", "error");
      return;
    }
    BXCore.setButtonLoading(submitBtn, true, "Saving...");

    const projectId = "project_" + Date.now();
    const name = String(fd.get("name") || "").trim();
    const description = String(fd.get("description") || "").trim();
    const projectDate = String(fd.get("projectDate") || "").trim();
    const status = String(fd.get("status") || "in-progress").trim();
    const driveLink = String(fd.get("driveLink") || "").trim();

    try {
      const resp = await BXCore.apiPost({
        action: "addProject",
        projectId,
        clientId,
        name,
        projectName: name,
        title: name,
        description,
        projectDate: projectDate || null,
        status,
        driveLink,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (!resp.ok) throw new Error(resp.error || "Create failed");

      e.target.reset();
      if (statusBox) {
        statusBox.textContent = "Project added successfully.";
        statusBox.style.display = "block";
        setTimeout(() => (statusBox.style.display = "none"), 2000);
      }
      showActionStatus("Project saved. The list is refreshed.", "success");

      data = await BXCore.apiGetAll(true);
      BXCore.updateSidebarStats(data);
      clients = data.clients || [];
      projects = data.projects || [];
      tasks = data.tasks || [];

      populateClientSelects();
      renderProjects();
    } catch (err) {
      console.error(err);
      showActionStatus("Couldn't save the project. Please try again.", "error");
    } finally {
      BXCore.setButtonLoading(submitBtn, false);
    }
  });

  populateClientSelects();
  renderProjects();
});
