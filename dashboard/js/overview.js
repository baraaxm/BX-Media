document.addEventListener("DOMContentLoaded", async () => {
  const sess = BXCore.requireAuth();
  if (!sess) return;
  const canManage = sess.role === "admin";

  const titleEl = document.getElementById("overviewTitle");
  const subtitleEl = document.getElementById("overviewSubtitle");
  const summaryEl = document.getElementById("overviewSummary");
  const activeProjectsEl = document.getElementById("overviewActiveProjects");
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

  const statusCopy = {
    "not-started": "Awaiting action",
    "in-progress": "In progress",
    completed: "Completed",
    blocked: "Awaiting action",
  };

  const getFriendlyStatus = (value = "") => statusCopy[value] || "In progress";
  const getStatusClass = (value = "") => (value === "blocked" ? "not-started" : value || "not-started");

  const renderTimeline = (items, projects, clients, options = {}) => {
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
        const statusValue = t.status || "not-started";
        const statusLabel = options.friendlyLabels
          ? getFriendlyStatus(statusValue)
          : statusValue.replace("-", " ");
        const marker = ">";
        const projectLabel = proj?.name || "Project";
        const statusLine = options.friendlyLabels
          ? `${projectLabel} - ${statusLabel}`
          : `${projectLabel} - Status: ${statusLabel}`;

        const item = document.createElement("div");
        item.className = "timeline-item";
        item.innerHTML = `
          <div class="timeline-marker">${marker}</div>
          <div class="timeline-content">
            <h4>${t.title || "Task update"}</h4>
            <p>${statusLine}</p>
            <div class="timeline-meta">
              <span>${BXCore.formatDateTime(t.updatedAt) || "No recent update"}</span>
              ${client && !options.friendlyLabels ? `<span>Client: ${client.clientName || client.username}</span>` : ""}
            </div>
          </div>
        `;
        timeline.appendChild(item);
      });

    activityEl.appendChild(timeline);
  };

  const renderActiveProjects = (projects = [], tasks = []) => {
    if (!activeProjectsEl) return;
    activeProjectsEl.innerHTML = "";

    if (!projects.length) {
      activeProjectsEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-folder-open"></i></div>
          <div>
            <h3>No active projects yet</h3>
            <p>Your BX Media team will add projects here once kickoff is complete.</p>
            <p class="empty-hint">Next step: check back after your next update.</p>
          </div>
        </div>
      `;
      return;
    }

    const activeProjects = projects.filter((p) => (p.status || "not-started") !== "completed");
    if (!activeProjects.length) {
      activeProjectsEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-circle-check"></i></div>
          <div>
            <h3>All projects are complete</h3>
            <p>You're all caught up for now. New work will appear here next.</p>
            <p class="empty-hint">Next step: review completed work in My Projects.</p>
          </div>
        </div>
      `;
      return;
    }
    const list = document.createElement("div");
    list.className = "project-rows";

    activeProjects.forEach((project) => {
      const statusValue = project.status || "not-started";
      const statusLabel = getFriendlyStatus(statusValue);
      const statusClass = getStatusClass(statusValue);
      const projectTasks = tasks.filter((t) => t.projectId === project.projectId);
      const progress = BXCore.computeProjectProgress(projectTasks);
      const progressLabel = progress === 0 ? "--" : `${progress}%`;

      const row = document.createElement("article");
      row.className = "project-row project-row-link simple";
      row.dataset.href = `client-dashboard-tasks.html?projectId=${encodeURIComponent(project.projectId)}`;
      row.innerHTML = `
        <div class="project-cell" data-label="Project">
          <div class="project-title">${project.name || "Untitled project"}</div>
        </div>
        <div class="project-cell" data-label="Status">
          <span class="project-status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="project-cell project-progress" data-label="Progress">
          <span class="progress-value">${progressLabel}</span>
          <progress max="100" value="${progress}"></progress>
        </div>
        <div class="project-cell project-action" data-label="Action">
          <button class="btn-secondary" type="button">View project</button>
        </div>
      `;
      list.appendChild(row);
    });

    activeProjectsEl.appendChild(list);
    activeProjectsEl.addEventListener("click", (e) => {
      const row = e.target.closest(".project-row-link");
      if (!row) return;
      if (e.target.closest("a")) return;
      BXCore.showPageLoader("Loading project tasks...");
      window.location.href = row.dataset.href;
    });
  };

  const renderSummaryCards = (cards) => {
    if (!summaryEl) return;
    summaryEl.innerHTML = "";
    cards.forEach(({ label, value, icon, tone }) => {
      const showEmpty = value === null || value === undefined || value === "";
      const div = document.createElement("div");
      div.className = `summary-card ${tone}`;
      div.innerHTML = `
        <span class="summary-icon icon"><i class="${icon}"></i></span>
        <div>
          <span>${label}</span>
          <strong>${showEmpty ? "--" : value}</strong>
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

    quickActionsEl.innerHTML = `
      <button class="quick-card${disabledClass}" type="button" data-quick="project" ${disabledAttr}>
        <span class="quick-icon"><i class="fas fa-plus"></i></span>
        <div class="quick-copy">
          <strong>Add project</strong>
        </div>
      </button>
      <button class="quick-card accent${disabledClass}" type="button" data-quick="task" ${disabledAttr}>
        <span class="quick-icon"><i class="fas fa-list-check"></i></span>
        <div class="quick-copy">
          <strong>Add task</strong>
        </div>
      </button>
      <button class="quick-card neutral${disabledClass}" type="button" data-quick="client" ${disabledAttr}>
        <span class="quick-icon"><i class="fas fa-user-plus"></i></span>
        <div class="quick-copy">
          <strong>Add client</strong>
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
    if (activeProjectsEl) BXCore.renderSkeleton(activeProjectsEl, "card", 3);
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
      const taskSummary = BXCore.computeSummary(tasks);
      renderSummaryCards([
        {
          label: "Active projects",
          value: summary.inProgress,
          icon: "fas fa-bolt",
          tone: "in-progress",
        },
        {
          label: "Tasks completed",
          value: `${taskSummary.completed}/${taskSummary.total}`,
          icon: "fas fa-list-check",
          tone: "neutral",
        },
        {
          label: "Completed projects",
          value: summary.completed,
          icon: "fas fa-check",
          tone: "completed",
        },
      ]);

      renderQuickActions(projects, tasks, clients, false);
      renderActiveProjects(projects, tasks);
      renderTimeline(tasks, projects, clients, { friendlyLabels: true });
    }
  } catch (err) {
    console.error(err);
    if (subtitleEl) {
      subtitleEl.textContent = "Failed to load data. Please refresh and try again.";
    }
  }
});


