document.addEventListener("DOMContentLoaded", async () => {
  const sess = BXCore.requireAuth();
  if (!sess) return;
  const canManage = sess.role === "admin";

  const titleEl = document.getElementById("overviewTitle");
  const subtitleEl = document.getElementById("overviewSubtitle");
  const summaryEl = document.getElementById("overviewSummary");
  const quickActionsEl = document.getElementById("overviewQuickActions");
  const tasksEl = document.getElementById("overviewTasks");
  const activityEl = document.getElementById("overviewActivity") || tasksEl;
  const quickModal = document.getElementById("quickActionModal");
  const quickModalTitle = document.getElementById("quickModalTitle");
  const quickModalHelper = document.getElementById("quickModalHelper");
  const quickModalStatus = document.getElementById("quickModalStatus");
  const quickCloseBtn = document.getElementById("quickModalClose");
  const quickProjectForm = document.getElementById("quickProjectForm");
  const quickTaskForm = document.getElementById("quickTaskForm");
  const quickClientForm = document.getElementById("quickClientForm");
  const quickProjectClient = document.getElementById("quickProjectClient");
  const quickTaskProject = document.getElementById("quickTaskProject");
  const quickTaskAssignee = document.getElementById("quickTaskAssignee");
  const quickProjectDate = document.getElementById("quickProjectDate");

  let clients = [];
  let projects = [];
  let tasks = [];

  const renderTimeline = (items, projects, clients) => {
    if (!activityEl) return;
    activityEl.innerHTML = "";
    if (!items.length) {
      activityEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-clock"></i></div>
          <div>
            <h3>No recent activity</h3>
            <p>Updates will appear here as BX Media moves your work forward.</p>
            <p class="empty-hint">Next step: check back after the next status update.</p>
          </div>
        </div>
      `;
      return;
    }

    const timeline = document.createElement("div");
    timeline.className = "timeline";

    items
      .slice()
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
      .slice(0, 12)
      .forEach((t) => {
        const proj = projects.find((p) => p.projectId === t.projectId);
        const client = proj ? clients.find((c) => c.clientId === proj.clientId) : null;
        const statusLabel = (t.status || "not-started").replace("-", " ");
        const marker = "•";

        const item = document.createElement("div");
        item.className = "timeline-item";
        item.innerHTML = `
          <div class="timeline-marker">${marker}</div>
          <div class="timeline-content">
            <h4>${t.title || "Task update"}</h4>
            <p>${proj?.name || "Project"} - Status: ${statusLabel}</p>
            <div class="timeline-meta">
              <span>${BXCore.formatDateTime(t.updatedAt) || "No recent update"}</span>
              ${client ? `<span>Client: ${client.clientName || client.username}</span>` : ""}
            </div>
          </div>
        `;
        timeline.appendChild(item);
      });

    activityEl.appendChild(timeline);
  };

  const renderSummaryCards = (cards) => {
    if (!summaryEl) return;
    summaryEl.innerHTML = "";
    cards.forEach(({ label, value, icon, tone, helper }) => {
      const showEmpty = Number(value) === 0;
      const div = document.createElement("div");
      div.className = `summary-card ${tone}`;
      div.innerHTML = `
        <span class="summary-icon"><i class="${icon}"></i></span>
        <div>
          <span>${label}</span>
          <strong>${showEmpty ? "--" : value}</strong>
          ${showEmpty ? `<span class="summary-helper">${helper}</span>` : ""}
        </div>
      `;
      summaryEl.appendChild(div);
    });
  };

  const setQuickStatus = (message = "", type = "error") => {
    if (!quickModalStatus) return;
    if (!message) {
      quickModalStatus.style.display = "none";
      return;
    }
    quickModalStatus.classList.remove("alert-error", "alert-success", "alert-info");
    quickModalStatus.classList.add(`alert-${type}`);
    quickModalStatus.textContent = message;
    quickModalStatus.style.display = "block";
  };

  const toggleQuickModal = (type = "project") => {
    if (!quickModal) return;
    const forms = {
      project: quickProjectForm,
      task: quickTaskForm,
      client: quickClientForm,
    };
    Object.values(forms).forEach((f) => {
      if (!f) return;
      f.style.display = "none";
    });
    const activeForm = forms[type] || forms.project;
    if (activeForm) activeForm.style.display = "grid";

    const helperCopy =
      type === "project"
        ? "Create a project and assign it to a client."
        : type === "task"
          ? "Drop in a task with status, progress, and due date."
          : "Add a client account so you can start projects for them.";
    if (quickModalTitle) quickModalTitle.textContent = `Quick add ${type}`;
    if (quickModalHelper) quickModalHelper.textContent = helperCopy;
    setQuickStatus("");

    quickModal.classList.add("is-open");
    quickModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  };

  const closeQuickModal = () => {
    if (!quickModal) return;
    quickModal.classList.remove("is-open");
    quickModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  };

  const bindQuickActions = () => {
    if (!quickActionsEl) return;
    if (quickActionsEl.dataset.bound === "true") return;
    quickActionsEl.dataset.bound = "true";

    quickActionsEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-quick]");
      if (!btn) return;
      if (btn.disabled || btn.getAttribute("aria-disabled") === "true") return;
      e.preventDefault();
      toggleQuickModal(btn.dataset.quick);
    });

    if (quickCloseBtn) quickCloseBtn.addEventListener("click", closeQuickModal);
    if (quickModal) {
      const backdrop = quickModal.querySelector(".modal-backdrop");
      if (backdrop) backdrop.addEventListener("click", closeQuickModal);
    }
    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", closeQuickModal);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && quickModal?.classList.contains("is-open")) {
        closeQuickModal();
      }
    });
  };

  const populateQuickSelects = (clients, projects) => {
    if (quickProjectClient) {
      quickProjectClient.innerHTML = "";
      (clients || []).forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.clientId;
        opt.textContent = c.clientName || c.username || c.clientId;
        quickProjectClient.appendChild(opt);
      });
    }

    if (quickTaskProject) {
      quickTaskProject.innerHTML = "";
      (projects || []).forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.projectId;
        opt.textContent = p.name || "Untitled project";
        quickTaskProject.appendChild(opt);
      });
    }
  };

  const renderQuickActions = (projects, tasks, clients, allowManage) => {
    if (!quickActionsEl) return;
    const manageAllowed = !!allowManage;
    const disabledAttr = manageAllowed ? "" : "disabled aria-disabled=\"true\"";
    const disabledClass = manageAllowed ? "" : " is-disabled";
    const disabledCopy = manageAllowed
      ? ""
      : "Managed by BX Media. Contact your producer for changes.";
    const latestUpdate = (tasks || [])
      .slice()
      .sort(
        (a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
      )
      .find((t) => t.updatedAt || t.createdAt);
    const updatesLabel = latestUpdate
      ? `Last activity ${BXCore.formatDateTime(latestUpdate.updatedAt || latestUpdate.createdAt)}`
      : "No updates yet. Activity will show here once work starts.";

    quickActionsEl.innerHTML = `
      <button class="quick-card accent${disabledClass}" type="button" data-quick="project" ${disabledAttr}>
        <span class="quick-icon"><i class="fas fa-plus"></i></span>
        <div class="quick-copy">
          <strong>Add project</strong>
          <span>${disabledCopy || (projects && projects.length
              ? "Create the next phase or a new client build."
              : "Start your first project and align the team.")}</span>
        </div>
      </button>
      <button class="quick-card${disabledClass}" type="button" data-quick="task" ${disabledAttr}>
        <span class="quick-icon"><i class="fas fa-list-check"></i></span>
        <div class="quick-copy">
          <strong>Add task</strong>
          <span>${disabledCopy || (tasks && tasks.length
              ? "Log the next deliverable with owners and due dates."
              : "Capture the first task to begin tracking progress.")}</span>
        </div>
      </button>
      <button class="quick-card neutral${disabledClass}" type="button" data-quick="client" ${disabledAttr}>
        <span class="quick-icon"><i class="fas fa-user-plus"></i></span>
        <div class="quick-copy">
          <strong>Add client</strong>
          <span>${disabledCopy || (projects && projects.length
              ? "Onboard a new client and link their projects."
              : "Add your first client to get projects and tasks organized.")}</span>
        </div>
      </button>
    `;

    populateQuickSelects(clients || [], projects || []);
    bindQuickActions();
  };

  const refreshData = async () => {
    const fresh = await BXCore.apiGetAll(true);
    BXCore.updateSidebarStats(fresh);
    clients = fresh.clients || [];
    projects = fresh.projects || [];
    tasks = fresh.tasks || [];
    populateQuickSelects(clients, projects);
  };

  if (quickProjectForm) {
    quickProjectForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!canManage) {
        setQuickStatus("You do not have permission to add projects.", "error");
        return;
      }
      setQuickStatus("");
      const submitBtn = quickProjectForm.querySelector("button[type='submit']");
      const clientId = quickProjectClient?.value;
      const name = quickProjectForm.querySelector("#quickProjectName")?.value.trim();
      const description = quickProjectForm.querySelector("#quickProjectDesc")?.value.trim() || "";
      const projectDate = quickProjectDate?.value || "";
      const driveLink = quickProjectForm.querySelector("#quickProjectDrive")?.value.trim() || "";
      const projectId = "project_" + Date.now();

      if (!clientId || !name) {
        setQuickStatus("Please select a client and add a project name.", "error");
        return;
      }

      BXCore.setButtonLoading(submitBtn, true, "Saving...");
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
          status: "in-progress",
          driveLink,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        if (!resp.ok) throw new Error(resp.error || "Create failed");
        quickProjectForm.reset();
        await refreshData();
        setQuickStatus("Project added successfully.", "success");
        BXCore.showToast("Project added successfully.", "success");
      } catch (err) {
        console.error(err);
        setQuickStatus("Couldn't add the project. Please try again.", "error");
        BXCore.showToast("Couldn't add the project. Please try again.", "error");
      } finally {
        BXCore.setButtonLoading(submitBtn, false);
      }
    });
  }

  if (quickTaskForm) {
    quickTaskForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!canManage) {
        setQuickStatus("You do not have permission to add tasks.", "error");
        return;
      }
      setQuickStatus("");
      const submitBtn = quickTaskForm.querySelector("button[type='submit']");
      const projectId = quickTaskProject?.value;
      const title = quickTaskForm.querySelector("#quickTaskTitle")?.value.trim();
      const description = quickTaskForm.querySelector("#quickTaskDesc")?.value.trim() || "";
      const assignee = quickTaskAssignee?.value || "bx-media";
      const status = quickTaskForm.querySelector("#quickTaskStatus")?.value || "in-progress";
      const progress = Number(quickTaskForm.querySelector("#quickTaskProgress")?.value || 0);
      const dueDate = quickTaskForm.querySelector("#quickTaskDue")?.value || "";
      const projectTasks = (tasks || []).filter((t) => t.projectId === projectId);
      const maxOrder = projectTasks.reduce((max, t) => {
        const val = Number(t.taskOrder);
        return Number.isFinite(val) ? Math.max(max, val) : max;
      }, 0);

      if (!projectId || !title) {
        setQuickStatus("Please select a project and add a task title.", "error");
        return;
      }

      BXCore.setButtonLoading(submitBtn, true, "Saving...");
      try {
        const resp = await BXCore.apiPost({
          action: "addTask",
          taskId: "task_" + Date.now(),
          projectId,
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
        quickTaskForm.reset();
        await refreshData();
        setQuickStatus("Task added successfully.", "success");
        BXCore.showToast("Task added successfully.", "success");
      } catch (err) {
        console.error(err);
        setQuickStatus("Couldn't add the task. Please try again.", "error");
        BXCore.showToast("Couldn't add the task. Please try again.", "error");
      } finally {
        BXCore.setButtonLoading(submitBtn, false);
      }
    });
  }

  if (quickClientForm) {
    quickClientForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!canManage) {
        setQuickStatus("You do not have permission to add clients.", "error");
        return;
      }
      setQuickStatus("");
      const submitBtn = quickClientForm.querySelector("button[type='submit']");
      const name = quickClientForm.querySelector("#quickClientName")?.value.trim();
      const username = quickClientForm.querySelector("#quickClientUsername")?.value.trim();
      const password = quickClientForm.querySelector("#quickClientPassword")?.value.trim();

      if (!name || !username || !password) {
        setQuickStatus("Please complete all client fields.", "error");
        return;
      }

      BXCore.setButtonLoading(submitBtn, true, "Saving...");
      try {
        const resp = await BXCore.apiPost({
          action: "addClient",
          clientId: "client_" + Date.now(),
          clientName: name,
          username,
          password,
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        if (!resp.ok) throw new Error(resp.error || "Create failed");
        quickClientForm.reset();
        await refreshData();
        setQuickStatus("Client added successfully.", "success");
        BXCore.showToast("Client added successfully.", "success");
      } catch (err) {
        console.error(err);
        setQuickStatus("Couldn't add the client. Please try again.", "error");
        BXCore.showToast("Couldn't add the client. Please try again.", "error");
      } finally {
        BXCore.setButtonLoading(submitBtn, false);
      }
    });
  }

  try {
    BXCore.renderSkeleton(summaryEl, "summary", 4);
    BXCore.renderSkeleton(activityEl, "timeline", 4);

    const data = await BXCore.apiGetAll();
    BXCore.updateSidebarStats(data);
    BXCore.renderClientHeader(data.clients || []);

    clients = data.clients || [];
    projects = data.projects || [];
    tasks = data.tasks || [];

    if (sess.role === "admin") {
      if (titleEl) titleEl.textContent = "Dashboard";
      if (subtitleEl)
        subtitleEl.textContent = "High-level view of all clients, projects, and task progress.";

      const summary = BXCore.computeProjectSummary(projects);
      renderSummaryCards([
        {
          label: "Total projects",
          value: projects.length,
          icon: "fas fa-folder-open",
          tone: "neutral",
          helper: "No active projects yet.",
        },
        {
          label: "In progress",
          value: summary.inProgress,
          icon: "fas fa-bolt",
          tone: "in-progress",
          helper: "No work in motion yet.",
        },
        {
          label: "Completed",
          value: summary.completed,
          icon: "fas fa-check",
          tone: "completed",
          helper: "No completed work yet.",
        },
        {
          label: "Not started",
          value: summary.notStarted,
          icon: "fas fa-pause",
          tone: "not-started",
          helper: "No queued work yet.",
        },
      ]);

      renderQuickActions(projects, tasks, clients, true);
      renderTimeline(tasks, projects, clients);
    } else {
      const client =
        clients.find((c) => c.clientId === sess.clientId) ||
        clients.find((c) => c.username === sess.username) ||
        clients[0];

      if (titleEl) titleEl.textContent = "Dashboard";
      if (subtitleEl)
        subtitleEl.textContent = client
          ? `Welcome back, ${client.clientName || sess.username}.`
          : `Welcome back, ${sess.username}.`;

      const summary = BXCore.computeProjectSummary(projects);
      renderSummaryCards([
        {
          label: "Total projects",
          value: projects.length,
          icon: "fas fa-folder-open",
          tone: "neutral",
          helper: "No active projects yet.",
        },
        {
          label: "In progress",
          value: summary.inProgress,
          icon: "fas fa-bolt",
          tone: "in-progress",
          helper: "No work in motion yet.",
        },
        {
          label: "Completed",
          value: summary.completed,
          icon: "fas fa-check",
          tone: "completed",
          helper: "No completed work yet.",
        },
        {
          label: "Not started",
          value: summary.notStarted,
          icon: "fas fa-pause",
          tone: "not-started",
          helper: "No queued work yet.",
        },
      ]);

      renderQuickActions(projects, tasks, clients, false);
      renderTimeline(tasks, projects, clients);
    }
  } catch (err) {
    console.error(err);
    if (subtitleEl) {
      subtitleEl.textContent = "Failed to load data. Please refresh and try again.";
    }
  }
});


