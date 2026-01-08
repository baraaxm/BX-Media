
document.addEventListener("DOMContentLoaded", async () => {
  const sess = BXCore.requireAuth({ role: "admin" });
  if (!sess) return;

  const isAdmin = sess.role === "admin";

  const clientSelect = document.getElementById("tasksClientSelect");
  const projectSelect = document.getElementById("tasksProjectSelect");
  const statusFilter = document.getElementById("tasksStatusFilter");
  const assigneeFilter = document.getElementById("tasksAssigneeFilter");
  const addTaskProjectSelect = document.getElementById("addTaskProjectSelect");
  const addTaskClientSelect = document.getElementById("addTaskClientSelect");
  const addTaskStatus = document.getElementById("addTaskStatus");
  const tasksTableWrapper = document.getElementById("tasksTableWrapper");
  const actionStatusEl = document.getElementById("tasksActionStatus");
  const addTaskModal = document.getElementById("addTaskModal");
  const openAddTaskInline = document.getElementById("openAddTaskInline");
  const addTaskType = document.getElementById("addTaskType");
  const addTaskMainSelect = document.getElementById("addTaskMainSelect");
  const addTaskParentRow = document.getElementById("addTaskParentRow");
  const addTaskTitle = document.getElementById("addTaskTitle");
  const addTaskAssignee = document.getElementById("addTaskAssignee");
  const addTaskStatusSelect = document.getElementById("addTaskStatusSelect");
  const addTaskProgress = document.getElementById("addTaskProgress");
  const addTaskDueDate = document.getElementById("addTaskDueDate");
  const taskEditModal = document.getElementById("taskEditModal");
  const taskEditMeta = document.getElementById("taskEditMeta");
  const taskEditForm = document.getElementById("taskEditForm");
  const taskEditTitle = document.getElementById("taskEditTitle");
  const taskEditDescription = document.getElementById("taskEditDescription");
  const taskEditAssignee = document.getElementById("taskEditAssignee");
  const taskEditStatus = document.getElementById("taskEditStatus");
  const taskEditProject = document.getElementById("taskEditProject");
  const taskEditParent = document.getElementById("taskEditParent");
  const taskEditProgress = document.getElementById("taskEditProgress");
  const taskEditDueDate = document.getElementById("taskEditDueDate");
  const taskEditDelete = document.getElementById("taskEditDelete");

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

  BXCore.renderSkeleton(tasksTableWrapper, "table", 1);

  let data;
  try {
    data = await BXCore.apiGetAll();
    BXCore.updateSidebarStats(data);
  } catch (err) {
    console.error(err);
    tasksTableWrapper.innerHTML =
      '<div class="empty">We could not load tasks. Please refresh and try again.</div>';
    showActionStatus("We could not load tasks. Please refresh and try again.", "error");
    return;
  }

  let clients = data.clients || [];
  let projects = data.projects || [];
  let tasks = pruneOrphanedSubtasks(data.tasks || []);
  let currentEditTask = null;
  const storageKeyBase = `bxm_tasks_${sess.username || sess.client_id || sess.clientId || "user"}`;
  const projectCollapseKey = `${storageKeyBase}_projects_collapsed`;
  const mainExpandKey = `${storageKeyBase}_main_expanded`;
  const collapsedProjectIds = new Set(
    JSON.parse(localStorage.getItem(projectCollapseKey) || "[]")
  );
  const expandedMainTaskIds = new Set(
    JSON.parse(localStorage.getItem(mainExpandKey) || "[]")
  );

  const persistSet = (key, set) => {
    localStorage.setItem(key, JSON.stringify([...set]));
  };

  let currentClientId = null;
  let currentProjectId = null;
  const quickProjectId = new URLSearchParams(window.location.search).get("projectId");

  if (!isAdmin) {
    if (clientSelect) clientSelect.style.display = "none";
    const client =
      clients.find((c) => c.clientId === sess.clientId) ||
      clients.find((c) => c.username === sess.username);
    currentClientId = client?.clientId || null;
  }

  const openAddTaskModal = () => {
    if (!addTaskModal) return;
    addTaskModal.classList.add("is-open");
    addTaskModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    if (addTaskType) addTaskType.value = "main";
    populateAddTaskMainSelect(addTaskProjectSelect?.value);
    updateAddTaskMainVisibility();
  };

  const closeAddTaskModal = () => {
    if (!addTaskModal) return;
    addTaskModal.classList.remove("is-open");
    addTaskModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  };

  if (openAddTaskInline) {
    openAddTaskInline.addEventListener("click", openAddTaskModal);
  }

  if (addTaskModal) {
    addTaskModal.addEventListener("click", (e) => {
      if (e.target.closest("[data-modal-close]")) {
        closeAddTaskModal();
      }
    });
  }

  function getVisibleProjects() {
    let list = projects.slice();
    if (currentClientId) {
      list = list.filter((p) => p.clientId === currentClientId);
    }
    return list;
  }

  function populateClientSelect() {
    if (!isAdmin) return;
    clientSelect.innerHTML = '<option value="all">All clients</option>';
    clients.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.clientId;
      opt.textContent = c.clientName || c.username || c.clientId;
      clientSelect.appendChild(opt);
    });
  }

  function populateProjectSelects() {
    const visibleProjects = getVisibleProjects();

    projectSelect.innerHTML = '<option value="all">All projects</option>';
    visibleProjects.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.projectId;
      opt.textContent = p.name || p.projectId;
      projectSelect.appendChild(opt);
    });
  }

  function populateAddTaskClientSelect() {
    if (!addTaskClientSelect) return;
    addTaskClientSelect.innerHTML = '<option value="">Select client</option>';
    clients.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.clientId;
      opt.textContent = c.clientName || c.username || c.clientId;
      addTaskClientSelect.appendChild(opt);
    });
    if (!isAdmin && currentClientId) {
      addTaskClientSelect.value = currentClientId;
      addTaskClientSelect.disabled = true;
    } else {
      addTaskClientSelect.disabled = false;
    }
  }

  function populateAddTaskProjectSelect(selectedProjectId) {
    if (!addTaskProjectSelect) return;
    const clientId = addTaskClientSelect ? addTaskClientSelect.value : "";
    addTaskProjectSelect.innerHTML = "";

    if (!clientId) {
      addTaskProjectSelect.disabled = true;
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Select client first";
      addTaskProjectSelect.appendChild(opt);
      populateAddTaskMainSelect(null);
      return;
    }

    const visibleProjects = projects.filter((p) => p.clientId === clientId);
    if (!visibleProjects.length) {
      addTaskProjectSelect.disabled = true;
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No projects for this client";
      addTaskProjectSelect.appendChild(opt);
      populateAddTaskMainSelect(null);
      return;
    }

    addTaskProjectSelect.disabled = false;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select project";
    addTaskProjectSelect.appendChild(placeholder);
    visibleProjects.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.projectId;
      opt.textContent = p.name || p.projectId;
      addTaskProjectSelect.appendChild(opt);
    });
    if (selectedProjectId) {
      addTaskProjectSelect.value = selectedProjectId;
    }
    populateAddTaskMainSelect(addTaskProjectSelect.value);
  }

  function updateAddTaskMainVisibility() {
    if (!addTaskMainSelect || !addTaskParentRow || !addTaskTitle || !addTaskType) return;
    const isSubtask = addTaskType.value === "subtask";
    const titleRow = addTaskTitle.closest(".form-row");
    if (addTaskMainSelect.disabled) {
      addTaskParentRow.style.display = "none";
      if (titleRow) titleRow.style.display = "none";
      addTaskTitle.required = false;
      return;
    }
    addTaskParentRow.style.display = isSubtask ? "block" : "none";
    if (titleRow) titleRow.style.display = "block";
    addTaskTitle.required = true;
  }

  function populateAddTaskMainSelect(projectId) {
    if (!addTaskMainSelect) return;
    addTaskMainSelect.innerHTML = "";
    if (!projectId) {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Select project first";
      addTaskMainSelect.appendChild(placeholder);
      addTaskMainSelect.disabled = true;
      updateAddTaskMainVisibility();
      return;
    }
    addTaskMainSelect.disabled = false;
    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "Select main task";
    addTaskMainSelect.appendChild(noneOpt);

    const mainTasks = tasks
      .filter((t) => isMainTask(t) && (!projectId || t.projectId === projectId))
      .sort((a, b) => getTaskOrderValue(a) - getTaskOrderValue(b));

    mainTasks.forEach((task) => {
      const opt = document.createElement("option");
      opt.value = task.taskId;
      opt.textContent = task.title || task.taskId;
      addTaskMainSelect.appendChild(opt);
    });
    addTaskMainSelect.value = "";
    updateAddTaskMainVisibility();
  }

  function buildProjectOptions(selectedId) {
    return projects
      .map(
        (p) =>
          `<option value="${p.projectId}" ${p.projectId === selectedId ? "selected" : ""}>${
            p.name || p.projectId
          }</option>`
      )
      .join("");
  }

  function buildParentTaskOptions(projectId, currentTaskId) {
    const mainTasks = tasks.filter((t) => isMainTask(t) && t.projectId === projectId);
    const options = ['<option value="">None (main task)</option>'];
    mainTasks.forEach((task) => {
      if (task.taskId === currentTaskId) return;
      const label = task.title || task.taskId;
      options.push(`<option value="${task.taskId}">${label}</option>`);
    });
    return options.join("");
  }

  function openTaskModal(task) {
    if (!taskEditModal || !taskEditForm) return;
    currentEditTask = task;
    const project = projects.find((p) => p.projectId === task.projectId);
    const client = project ? clients.find((c) => c.clientId === project.clientId) : null;
    if (taskEditMeta) {
      const projectLabel = project?.name || "Unknown project";
      const clientLabel = client?.clientName || client?.username || "Unknown client";
      taskEditMeta.textContent = `${projectLabel} \u2022 ${clientLabel}`;
    }
    if (taskEditTitle) taskEditTitle.value = task.title || "";
    if (taskEditDescription) taskEditDescription.value = task.description || "";
    if (taskEditAssignee) taskEditAssignee.value = task.assignee || "bx-media";
    if (taskEditStatus) taskEditStatus.value = task.status || "not-started";
    if (taskEditProject) taskEditProject.innerHTML = buildProjectOptions(task.projectId);
    if (taskEditParent) {
      taskEditParent.innerHTML = buildParentTaskOptions(task.projectId, task.taskId);
      taskEditParent.value = getParentTaskId(task) || "";
    }
    if (taskEditProgress) taskEditProgress.value = Number.isFinite(task.progress) ? task.progress : 0;
    if (taskEditDueDate) taskEditDueDate.value = task.dueDate || "";

    taskEditModal.classList.add("is-open");
    taskEditModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeTaskModal() {
    if (!taskEditModal) return;
    taskEditModal.classList.remove("is-open");
    taskEditModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    currentEditTask = null;
  }
  function getClientNameForTask(task) {
    const project = projects.find((p) => p.projectId === task.projectId);
    if (!project) return "Unknown client";
    const client = clients.find((c) => c.clientId === project.clientId);
    return client?.clientName || client?.username || client?.clientId || "Unknown client";
  }

  function getProjectNameForTask(task) {
    const project = projects.find((p) => p.projectId === task.projectId);
    return project?.name || project?.projectId || "Unknown project";
  }

  const MAIN_TASK_ORDER = [
    "Production",
    "Post-Production (Video)",
    "Reel Cutdowns",
    "Photo Deliverables",
    "Finalization",
    "Payment",
  ];

  const SUBTASK_ORDER = {
    "Production": [
      "Shooting Day ? 6 Jan",
      "Choose & Approve Music Tracks",
    ],
    "Post-Production (Video)": [
      "Offline Cut",
      "Post-Production Editing",
      "Draft 1 Finishing",
      "Draft 1 Review & Approval",
      "Final Draft Edit",
      "Final Draft Review",
      "Final Draft Approval",
    ],
    "Reel Cutdowns": [
      "Reel Cutdowns Editing",
      "Reel Cutdowns Delivery",
      "Reel Cutdowns Approval",
    ],
    "Photo Deliverables": [
      "Photo Post-Production & Retouching",
      "Photo Delivery",
      "Photo Approval",
    ],
    "Finalization": [
      "Final Approval & Project Closing",
    ],
    "Payment": [
      "Final Payment",
    ],
  };

  const normalizeTaskTitle = (title) => String(title || "").trim();

  const buildOrderMap = (items) => {
    const map = new Map();
    (items || []).forEach((label, idx) => {
      map.set(normalizeTaskTitle(label), idx);
    });
    return map;
  };

  const MAIN_TASK_ORDER_MAP = buildOrderMap(MAIN_TASK_ORDER);

  const sortByExplicitOrder = (list, orderMap) =>
    (list || []).slice().sort((a, b) => {
      const aKey = normalizeTaskTitle(a.title);
      const bKey = normalizeTaskTitle(b.title);
      const aIndex = orderMap.has(aKey) ? orderMap.get(aKey) : Number.MAX_SAFE_INTEGER;
      const bIndex = orderMap.has(bKey) ? orderMap.get(bKey) : Number.MAX_SAFE_INTEGER;
      if (aIndex !== bIndex) return aIndex - bIndex;
      return aKey.localeCompare(bKey);
    });

  function getTaskOrderValue(task) {
    const raw =
      task.orderIndex ?? task.order_index ?? task.order_index ?? task.taskOrder ?? task.task_order;
    const val = Number(raw);
    if (Number.isFinite(val)) return val;
    const fallback = new Date(task.updatedAt || task.createdAt || 0).getTime();
    return Number.isFinite(fallback) ? fallback : Number.MAX_SAFE_INTEGER;
  }

  const hasManualOrder = (list) =>
    (list || []).some((task) => Number.isFinite(Number(task.taskOrder)));

  const sortByManualOrder = (list) =>
    (list || []).slice().sort((a, b) => getTaskOrderValue(a) - getTaskOrderValue(b));

  const sortMainTasks = (list) =>
    hasManualOrder(list) ? sortByManualOrder(list) : sortByExplicitOrder(list, MAIN_TASK_ORDER_MAP);

  function getParentTaskId(task) {
    const raw = task?.parentTaskId ?? task?.parent_task_id ?? null;
    if (raw === "" || raw === undefined || raw === null) return null;
    return raw;
  }

  function isMainTask(task) {
    return !getParentTaskId(task);
  }

  function pruneOrphanedSubtasks(list) {
    const taskIds = new Set((list || []).map((t) => t.taskId));
    return (list || []).filter((task) => {
      const parentId = getParentTaskId(task);
      if (!parentId) return true;
      return taskIds.has(parentId);
    });
  }

  function buildDerivedTasks(list) {
    const source = list || [];
    const taskMap = new Map(source.map((t) => [t.taskId, t]));
    const subtasksByParent = new Map();
    source.forEach((task) => {
      const parentId = getParentTaskId(task);
      if (!parentId || !taskMap.has(parentId)) return;
      if (!subtasksByParent.has(parentId)) subtasksByParent.set(parentId, []);
      subtasksByParent.get(parentId).push(task);
    });

    return source
      .filter((task) => {
        const parentId = getParentTaskId(task);
        if (!parentId) return true;
        return taskMap.has(parentId);
      })
      .map((task) => {
        const next = { ...task };
        const parentId = getParentTaskId(next);
        if (!parentId) {
          const subs = subtasksByParent.get(next.taskId) || [];
          if (subs.length) {
            const total = subs.reduce((sum, sub) => sum + Number(sub.progress || 0), 0);
            next.progress = Math.round(total / subs.length);
          }
        }
        return next;
      });
  }

  function removeTaskFromState(list, taskToDelete) {
    const source = list || [];
    if (!taskToDelete?.taskId) return pruneOrphanedSubtasks(source);
    const targetId = taskToDelete.taskId;
    const isMain = !getParentTaskId(taskToDelete);
    const filtered = source.filter((task) => {
      if (task.taskId === targetId) return false;
      if (isMain && getParentTaskId(task) === targetId) return false;
      return true;
    });
    return pruneOrphanedSubtasks(filtered);
  }

  function keepExpandedIdsFor(tasksList) {
    const mainIds = new Set(tasksList.filter(isMainTask).map((t) => t.taskId));
    [...expandedMainTaskIds].forEach((taskId) => {
      if (!mainIds.has(taskId)) expandedMainTaskIds.delete(taskId);
    });
    persistSet(mainExpandKey, expandedMainTaskIds);
  }

  const formatStatusLabel = (status) =>
    String(status || "not-started").replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const computeStatusFromTasks = (list) => {
    if (!list.length) return "not-started";
    const statuses = list.map((t) => t.status || "not-started");
    if (statuses.every((s) => s === "completed")) return "completed";
    if (statuses.some((s) => s === "in-progress" || s === "blocked" || s === "completed"))
      return "in-progress";
    return "not-started";
  };

  const computeProgressFromTasks = (list) => {
    if (!list.length) return 0;
    const total = list.reduce((sum, t) => sum + Number(t.progress || 0), 0);
    return Math.round(total / list.length);
  };

  const getAssigneeLabel = (assignee) => (assignee === "client" ? "Client" : "BX Media");

  function renderTasks() {
    tasksTableWrapper.innerHTML = "";

    if (!tasks.length) {
      tasksTableWrapper.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-list-check"></i></div>
          <div>
            <h3>No tasks yet</h3>
            <p>Create the first task to start tracking delivery.</p>
            <button class="btn-primary" type="button" id="emptyAddTask">
              <i class="fas fa-plus"></i> Add task
            </button>
          </div>
        </div>
      `;
      const emptyAddBtn = document.getElementById("emptyAddTask");
      if (emptyAddBtn) emptyAddBtn.addEventListener("click", openAddTaskModal);
      return;
    }

    const derivedTasks = buildDerivedTasks(tasks);

    let filtered = derivedTasks.slice();
    if (currentClientId) {
      const projIds = getVisibleProjects().map((p) => p.projectId);
      filtered = filtered.filter((t) => projIds.includes(t.projectId));
    }
    if (projectSelect.value !== "all") {
      filtered = filtered.filter((t) => t.projectId === projectSelect.value);
    }
    if (statusFilter.value !== "all") {
      filtered = filtered.filter((t) => (t.status || "not-started") === statusFilter.value);
    }
    if (assigneeFilter && assigneeFilter.value !== "all") {
      filtered = filtered.filter((t) => (t.assignee || "bx-media") === assigneeFilter.value);
    }

    if (!filtered.length) {
      tasksTableWrapper.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-list-check"></i></div>
          <div>
            <h3>No tasks match the filters</h3>
            <p>Adjust filters or create a new task.</p>
          </div>
        </div>
      `;
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = "tasks-groups";
    const canReorder = isAdmin;

    const filteredTaskIds = new Set(filtered.map((task) => task.taskId));
    const subtaskMap = new Map();
    filtered.forEach((task) => {
      const parentId = getParentTaskId(task);
      if (!parentId) return;
      if (!subtaskMap.has(parentId)) subtaskMap.set(parentId, []);
      subtaskMap.get(parentId).push(task);
    });

    const visibleMainTasks = derivedTasks
      .filter(isMainTask)
      .filter((task) => filteredTaskIds.has(task.taskId) || subtaskMap.has(task.taskId));
    keepExpandedIdsFor(visibleMainTasks);

    const visibleProjects = getVisibleProjects().filter((p) => {
      if (projectSelect.value !== "all") return p.projectId === projectSelect.value;
      return true;
    });

    const sortSubtasksForParent = (parentTitle, list) => {
      if (hasManualOrder(list)) return sortByManualOrder(list);
      const subOrder = SUBTASK_ORDER[normalizeTaskTitle(parentTitle)] || [];
      const subOrderMap = buildOrderMap(subOrder);
      return sortByExplicitOrder(list, subOrderMap);
    };

    let hasGroups = false;
    visibleProjects.forEach((project) => {
      const projectMainTasks = visibleMainTasks.filter((task) => task.projectId === project.projectId);
      if (!projectMainTasks.length) return;
      hasGroups = true;

      const projectStatusSource = projectMainTasks.map((task) => {
        const subs = subtaskMap.get(task.taskId) || [];
        if (!subs.length) return task;
        return { status: computeStatusFromTasks(subs), progress: computeProgressFromTasks(subs) };
      });
      const projectStatus = computeStatusFromTasks(projectStatusSource);
      const projectProgress = computeProgressFromTasks(projectStatusSource);
      const isProjectCollapsed = collapsedProjectIds.has(project.projectId);

      const projectGroup = document.createElement("section");
      projectGroup.className = "task-project-group";
      projectGroup.dataset.projectId = project.projectId;
      projectGroup.innerHTML = `
        <button class="task-project-header" type="button" data-project-id="${project.projectId}" aria-expanded="${!isProjectCollapsed}">
          <div class="task-project-title">
            <h3>${project.name || project.projectId}</h3>
            <span class="task-project-status ${projectStatus}">${formatStatusLabel(projectStatus)}</span>
          </div>
          <div class="task-project-progress">
            <progress max="100" value="${projectProgress}"></progress>
            <span>${projectProgress}%</span>
          </div>
        </button>
        <div class="task-project-body ${isProjectCollapsed ? "is-collapsed" : ""}">
          <div class="task-main-list"></div>
        </div>
      `;

      const mainList = projectGroup.querySelector(".task-main-list");
      const orderedMainTasks = sortMainTasks(projectMainTasks);

      orderedMainTasks.forEach((task) => {
        const visibleSubs = subtaskMap.get(task.taskId) || [];
        const isExpanded = expandedMainTaskIds.has(task.taskId);
        const mainStatus = visibleSubs.length ? computeStatusFromTasks(visibleSubs) : task.status || "not-started";
        const mainProgress = visibleSubs.length
          ? computeProgressFromTasks(visibleSubs)
          : Math.max(0, Math.min(100, Number(task.progress || 0)));
        const dueLabel = BXCore.formatDate(task.dueDate);
        const mainRow = document.createElement("div");
        mainRow.className = "task-row task-main-row";
        mainRow.dataset.taskId = task.taskId;
        mainRow.dataset.taskRole = "main";
        mainRow.dataset.projectId = project.projectId;
        mainRow.draggable = Boolean(canReorder);
        if (canReorder) mainRow.classList.add("is-draggable");

        mainRow.innerHTML = `
          <button class="task-toggle" type="button" data-task-id="${task.taskId}" aria-expanded="${isExpanded}" ${visibleSubs.length ? "" : "disabled"}>
            <i class="fas fa-chevron-${isExpanded ? "down" : "right"}"></i>
          </button>
          <div class="task-main-info">
            <div class="task-title">${task.title || "Untitled task"}</div>
            <div class="task-meta">
              <span>${getAssigneeLabel(task.assignee)}</span>
              ${dueLabel ? `<span class="task-dot">•</span><span>${dueLabel}</span>` : ""}
            </div>
          </div>
          <div class="task-main-progress">
            <progress max="100" value="${mainProgress}"></progress>
            <span>${mainProgress}%</span>
          </div>
          <span class="task-status ${mainStatus}">${formatStatusLabel(mainStatus)}</span>
          ${isAdmin ? `<button class="btn-secondary btn-compact task-edit-open" type="button">Edit</button>` : ""}
          ${canReorder ? `<span class="task-drag-handle" title="Drag to reorder"><i class="fas fa-grip-lines"></i></span>` : ""}
        `;
        mainList.appendChild(mainRow);

        const subtaskList = document.createElement("div");
        subtaskList.className = `task-subtasks ${isExpanded ? "is-open" : ""}`;
        subtaskList.dataset.parentTaskId = task.taskId;
        if (visibleSubs.length) {
          sortSubtasksForParent(task.title, visibleSubs).forEach((subtask) => {
            const subRow = document.createElement("div");
            subRow.className = "task-row task-subtask-row";
            subRow.dataset.taskId = subtask.taskId;
            subRow.dataset.taskRole = "subtask";
            subRow.dataset.parentTaskId = task.taskId;
            subRow.dataset.projectId = project.projectId;
            subRow.draggable = Boolean(canReorder);
            if (canReorder) subRow.classList.add("is-draggable");
            const subStatus = subtask.status || "not-started";
            subRow.innerHTML = `
              <div class="task-subtask-title">${subtask.title || "Untitled subtask"}</div>
              ${subtask.assignee ? `<span class="task-subtask-assignee">${getAssigneeLabel(subtask.assignee)}</span>` : ""}
              <span class="task-status ${subStatus}">${formatStatusLabel(subStatus)}</span>
              ${isAdmin ? `<button class="btn-secondary btn-compact task-edit-open" type="button">Edit</button>` : ""}
              ${canReorder ? `<span class="task-drag-handle" title="Drag to reorder"><i class="fas fa-grip-lines"></i></span>` : ""}
            `;
            subtaskList.appendChild(subRow);
          });
        }
        mainList.appendChild(subtaskList);
      });

      wrap.appendChild(projectGroup);
    });

    if (!hasGroups) {
      tasksTableWrapper.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-list-check"></i></div>
          <div>
            <h3>No tasks match the filters</h3>
            <p>Adjust filters or create a new task.</p>
          </div>
        </div>
      `;
      return;
    }

    wrap.addEventListener("click", (e) => {
      const projectToggle = e.target.closest(".task-project-header");
      if (projectToggle) {
        const projectId = projectToggle.dataset.projectId;
        if (!projectId) return;
        const body = projectToggle.parentElement?.querySelector(".task-project-body");
        const isCollapsed = body?.classList.toggle("is-collapsed");
        projectToggle.setAttribute("aria-expanded", String(!isCollapsed));
        if (isCollapsed) {
          collapsedProjectIds.add(projectId);
        } else {
          collapsedProjectIds.delete(projectId);
        }
        persistSet(projectCollapseKey, collapsedProjectIds);
        return;
      }

      const toggle = e.target.closest(".task-toggle");
      if (toggle) {
        const taskId = toggle.dataset.taskId;
        if (!taskId) return;
        if (expandedMainTaskIds.has(taskId)) {
          expandedMainTaskIds.delete(taskId);
        } else {
          expandedMainTaskIds.add(taskId);
        }
        persistSet(mainExpandKey, expandedMainTaskIds);
        renderTasks();
        return;
      }

      const editBtn = e.target.closest(".task-edit-open");
      if (editBtn) {
        const row = editBtn.closest(".task-row");
        const taskId = row?.dataset.taskId;
        if (!taskId) return;
        const task = derivedTasks.find((item) => item.taskId === taskId);
        if (task) openTaskModal(task);
      }
    });

    if (canReorder) {
      let dragRow = null;
      let dragRole = null;
      let dragParentId = null;
      let dragProjectId = null;
      let dragSnapshot = null;

      const isDragHandle = (target) => Boolean(target.closest(".task-drag-handle"));

      const getEligibleRows = (container) =>
        [...container.querySelectorAll(`.task-row[data-task-role="${dragRole}"]:not(.is-dragging)`)];

      const getRowAfter = (container, y, rows) =>
        (rows || []).reduce(
          (closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
              return { offset, element: child };
            }
            return closest;
          },
          { offset: Number.NEGATIVE_INFINITY, element: null }
        ).element;

      const applyOrderUpdates = async (updates) => {
        const prev = new Map(tasks.map((t) => [t.taskId, t.taskOrder]));
        dragSnapshot = prev;
        const updateMap = new Map(updates.map((u) => [u.taskId, u.taskOrder]));
        const parentMap = new Map(
          updates
            .filter((u) => u.parentTaskId !== undefined)
            .map((u) => [u.taskId, u.parentTaskId])
        );
        tasks = tasks.map((task) => {
          if (!updateMap.has(task.taskId)) return task;
          const nextParent = parentMap.has(task.taskId)
            ? parentMap.get(task.taskId)
            : getParentTaskId(task);
          return {
            ...task,
            taskOrder: updateMap.get(task.taskId),
            order_index: updateMap.get(task.taskId),
            parentTaskId: nextParent,
            parent_task_id: nextParent,
          };
        });

        try {
          const responses = await Promise.all(
            updates.map((u) =>
              BXCore.apiPost({
                action: "updateTask",
                taskId: u.taskId,
                taskOrder: u.taskOrder,
                order_index: u.taskOrder,
                parentTaskId: u.parentTaskId,
                parent_task_id: u.parentTaskId,
              })
            )
          );
          const failed = responses.find((resp) => !resp?.ok);
          if (failed) throw new Error(failed.error || "Update failed");
          BXCore.showToast("Task order updated.", "success");
        } catch (err) {
          console.error(err);
          tasks = tasks.map((task) => {
            if (!dragSnapshot || !dragSnapshot.has(task.taskId)) return task;
            return { ...task, taskOrder: dragSnapshot.get(task.taskId), order_index: dragSnapshot.get(task.taskId) };
          });
          BXCore.showToast("Couldn't save task order. Please try again.", "error");
        } finally {
          renderTasks();
        }
      };

      const beginDrag = (row) => {
        dragRow = row;
        dragRole = row.dataset.taskRole;
        dragParentId = row.dataset.parentTaskId || null;
        dragProjectId = row.dataset.projectId || null;
        row.classList.add("is-dragging");
      };

      wrap.addEventListener("dragstart", (e) => {
        const row = e.target.closest(".task-row");
        if (!row || !isDragHandle(e.target)) {
          e.preventDefault();
          return;
        }
        beginDrag(row);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", row.dataset.taskId || "");
      });

      wrap.addEventListener("dragover", (e) => {
        if (!dragRow) return;
        let container = dragRole === "main"
          ? dragRow.closest(".task-main-list")
          : wrap.querySelector(`.task-subtasks[data-parent-task-id="${dragParentId}"]`);
        if (!container) return;
        const overRow = e.target.closest(".task-row");
        const overProjectId = overRow?.dataset.projectId;
        let overParentId = overRow?.dataset.parentTaskId || null;
        if (dragRole === "subtask") {
          if (overRow?.classList.contains("task-main-row")) {
            overParentId = overRow.dataset.taskId || null;
          }
          if (overParentId) {
            container =
              wrap.querySelector(`.task-subtasks[data-parent-task-id="${overParentId}"]`) || container;
          }
        }

        const isValid =
          dragRole === "main"
            ? overProjectId === dragProjectId
            : overProjectId === dragProjectId;

        if (!isValid) {
          document.body.classList.add("drag-invalid");
          if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
          return;
        }
        document.body.classList.remove("drag-invalid");
        e.preventDefault();
        const eligible = getEligibleRows(container);
        const after = getRowAfter(container, e.clientY, eligible);
        if (after == null) {
          container.appendChild(dragRow);
        } else {
          container.insertBefore(dragRow, after);
        }
        eligible.forEach((row) => row.classList.remove("is-drag-over"));
        if (overRow && overRow !== dragRow && eligible.includes(overRow)) {
          overRow.classList.add("is-drag-over");
        }
      });

      wrap.addEventListener("drop", (e) => {
        if (!dragRow) return;
        e.preventDefault();
        let container = dragRole === "main"
          ? dragRow.closest(".task-main-list")
          : wrap.querySelector(`.task-subtasks[data-parent-task-id="${dragParentId}"]`);
        if (!container) return;
        let nextParentId = dragParentId;
        if (dragRole === "subtask") {
          const overRow = e.target.closest(".task-row");
          if (overRow?.classList.contains("task-main-row")) {
            nextParentId = overRow.dataset.taskId || dragParentId;
            container = wrap.querySelector(`.task-subtasks[data-parent-task-id="${nextParentId}"]`) || container;
          } else if (overRow?.dataset.parentTaskId) {
            nextParentId = overRow.dataset.parentTaskId;
            container = wrap.querySelector(`.task-subtasks[data-parent-task-id="${nextParentId}"]`) || container;
          }
        }
        const rows = [...container.querySelectorAll(`.task-row[data-task-role="${dragRole}"]`)];
        const updates = rows.map((row, index) => ({
          taskId: row.dataset.taskId,
          taskOrder: index + 1,
          parentTaskId: dragRole === "subtask" ? nextParentId : undefined,
        }));
        applyOrderUpdates(updates);
      });

      wrap.addEventListener("dragend", () => {
        document.body.classList.remove("drag-invalid");
        wrap.querySelectorAll(".task-row").forEach((row) => {
          row.classList.remove("is-dragging", "is-drag-over");
        });
        dragRow = null;
        dragRole = null;
        dragParentId = null;
        dragProjectId = null;
        dragSnapshot = null;
      });

      wrap.addEventListener("pointerdown", (e) => {
        const row = e.target.closest(".task-row");
        if (!row || !isDragHandle(e.target)) return;
        e.preventDefault();
        beginDrag(row);
        let container = dragRole === "main"
          ? row.closest(".task-main-list")
          : wrap.querySelector(`.task-subtasks[data-parent-task-id="${dragParentId}"]`);
        if (!container) return;
        let nextParentId = dragParentId;

        const onMove = (ev) => {
          const target = document.elementFromPoint(ev.clientX, ev.clientY);
          const hover = target ? target.closest(".task-row") : null;
          const hoverProjectId = hover?.dataset.projectId;
          let hoverParentId = hover?.dataset.parentTaskId || null;
          if (dragRole === "subtask") {
            if (hover?.classList.contains("task-main-row")) {
              hoverParentId = hover.dataset.taskId || null;
            }
            if (hoverParentId) {
              container =
                wrap.querySelector(`.task-subtasks[data-parent-task-id="${hoverParentId}"]`) ||
                container;
            }
          }
          const isValid =
            dragRole === "main"
              ? hoverProjectId === dragProjectId
              : hoverProjectId === dragProjectId;

          if (!isValid) {
            document.body.classList.add("drag-invalid");
            return;
          }
          document.body.classList.remove("drag-invalid");
          const eligible = getEligibleRows(container);
          const after = getRowAfter(container, ev.clientY, eligible);
          if (after == null) {
            container.appendChild(dragRow);
          } else {
            container.insertBefore(dragRow, after);
          }
          eligible.forEach((r) => r.classList.remove("is-drag-over"));
          if (hover && hover !== dragRow && eligible.includes(hover)) {
            hover.classList.add("is-drag-over");
          }
          nextParentId = hoverParentId || dragParentId;
        };

        const onUp = () => {
          document.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerup", onUp);
          document.body.classList.remove("drag-invalid");
          wrap.querySelectorAll(".task-row").forEach((r) => {
            r.classList.remove("is-dragging", "is-drag-over");
          });
          const rows = [...container.querySelectorAll(`.task-row[data-task-role="${dragRole}"]`)];
          const updates = rows.map((r, index) => ({
            taskId: r.dataset.taskId,
            taskOrder: index + 1,
            parentTaskId: dragRole === "subtask" ? nextParentId : undefined,
          }));
          dragRow = null;
          dragRole = null;
          dragParentId = null;
          dragProjectId = null;
          applyOrderUpdates(updates);
        };

        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp, { once: true });
      });
    }

    tasksTableWrapper.appendChild(wrap);
  }

  clientSelect.addEventListener("change", () => {
    currentClientId = clientSelect.value === "all" ? null : clientSelect.value;
    populateProjectSelects();
    renderTasks();
  });

  projectSelect.addEventListener("change", () => {
    currentProjectId = projectSelect.value === "all" ? null : projectSelect.value;
    renderTasks();
  });

  if (addTaskClientSelect) {
    addTaskClientSelect.addEventListener("change", () => {
      populateAddTaskProjectSelect();
    });
  }

  if (addTaskProjectSelect) {
    addTaskProjectSelect.addEventListener("change", () => {
      populateAddTaskMainSelect(addTaskProjectSelect.value);
    });
  }

  if (addTaskMainSelect) {
    addTaskMainSelect.addEventListener("change", updateAddTaskMainVisibility);
  }

  if (addTaskType) {
    addTaskType.addEventListener("change", updateAddTaskMainVisibility);
  }

  statusFilter.addEventListener("change", renderTasks);
  if (assigneeFilter) {
    assigneeFilter.addEventListener("change", renderTasks);
  }

  if (taskEditModal) {
    taskEditModal.addEventListener("click", (e) => {
      if (e.target.closest("[data-modal-close]")) {
        closeTaskModal();
      }
    });
  }

  if (taskEditProject && taskEditParent) {
    taskEditProject.addEventListener("change", () => {
      if (!currentEditTask) return;
      taskEditParent.innerHTML = buildParentTaskOptions(taskEditProject.value, currentEditTask.taskId);
      taskEditParent.value = getParentTaskId(currentEditTask) || "";
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && taskEditModal?.classList.contains("is-open")) {
      closeTaskModal();
    }
    if (e.key === "Escape" && addTaskModal?.classList.contains("is-open")) {
      closeAddTaskModal();
    }
  });

  if (taskEditDelete) {
    taskEditDelete.addEventListener("click", async () => {
      if (!currentEditTask) return;
      const confirmDelete = await BXCore.confirmAction({
        title: "Delete task?",
        message: "This will permanently remove the task from the project.",
        confirmLabel: "Delete task",
        tone: "danger",
      });
      if (!confirmDelete) return;
      BXCore.setButtonLoading(taskEditDelete, true, "Deleting...");
      try {
        const taskToDelete = currentEditTask;
        const resp = await BXCore.apiPost({ action: "deleteTask", taskId: currentEditTask.taskId });
        if (!resp.ok) throw new Error(resp.error || "Delete failed");
        tasks = removeTaskFromState(tasks, taskToDelete);
        keepExpandedIdsFor(tasks);
        closeTaskModal();
        renderTasks();
        data = await BXCore.apiGetAll(true);
        BXCore.updateSidebarStats(data);
        projects = data.projects || [];
        tasks = pruneOrphanedSubtasks(data.tasks || []);
        keepExpandedIdsFor(tasks);
        renderTasks();
        showActionStatus("Task removed. The list is up to date.", "success");
      } catch (err) {
        console.error(err);
        showActionStatus("Couldn't delete the task. Please try again.", "error");
      } finally {
        BXCore.setButtonLoading(taskEditDelete, false);
      }
    });
  }

  if (taskEditForm) {
    taskEditForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentEditTask) return;
      const submitBtn = taskEditForm.querySelector("button[type=\"submit\"]");
      const nextTitle = taskEditTitle ? taskEditTitle.value.trim() : "";
      if (!nextTitle) {
        showActionStatus("Task title is required.", "error");
        return;
      }
      const nextDescription = taskEditDescription ? taskEditDescription.value.trim() : "";
      const nextAssignee = taskEditAssignee ? taskEditAssignee.value : "bx-media";
      const nextStatus = taskEditStatus ? taskEditStatus.value : "not-started";
      const nextProjectId = taskEditProject ? taskEditProject.value : currentEditTask.projectId;
      const nextParentId = taskEditParent ? taskEditParent.value : "";
      if (nextParentId && nextParentId === currentEditTask.taskId) {
        showActionStatus("A task cannot be its own parent.", "error");
        return;
      }
      const nextProgress = taskEditProgress ? Number(taskEditProgress.value || 0) : 0;
      const nextDueDate = taskEditDueDate && taskEditDueDate.value ? taskEditDueDate.value : null;

      BXCore.setButtonLoading(submitBtn, true, "Saving...");
      try {
        const resp = await BXCore.apiPost({
          action: "updateTask",
          taskId: currentEditTask.taskId,
          projectId: nextProjectId,
          title: nextTitle,
          description: nextDescription,
          assignee: nextAssignee,
          status: nextStatus,
          progress: Number.isFinite(nextProgress) ? nextProgress : 0,
          dueDate: nextDueDate,
          parentTaskId: nextParentId || null,
          parent_task_id: nextParentId || null,
          updatedAt: new Date().toISOString(),
        });
        if (!resp.ok) throw new Error(resp.error || "Update failed");
        data = await BXCore.apiGetAll(true);
        BXCore.updateSidebarStats(data);
        projects = data.projects || [];
        tasks = pruneOrphanedSubtasks(data.tasks || []);
        closeTaskModal();
        renderTasks();
        showActionStatus("Task updated successfully.", "success");
      } catch (err) {
        console.error(err);
        showActionStatus("Couldn't update the task. Please try again.", "error");
      } finally {
        BXCore.setButtonLoading(submitBtn, false);
      }
    });
  }

  document.getElementById("addTaskForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (addTaskStatus) addTaskStatus.style.display = "none";
    const submitBtn = e.target.querySelector("button[type=\"submit\"]");

    const fd = new FormData(e.target);
    const clientId = String(fd.get("clientId") || "").trim();
    const projectId = String(fd.get("projectId") || "").trim();
    const taskType = String(fd.get("taskType") || "main").trim();
    const mainSelection = String(fd.get("mainTask") || "").trim();
    if (!clientId) {
      showActionStatus("Please select a client before adding a task.", "error");
      return;
    }
    if (!projectId) {
      showActionStatus("Please select a project before adding a task.", "error");
      return;
    }
    if (taskType === "subtask" && !mainSelection) {
      showActionStatus("Please select a parent main task.", "error");
      return;
    }
    const projectMatch = projects.find((p) => p.projectId === projectId);
    if (projectMatch && projectMatch.clientId !== clientId) {
      showActionStatus("Selected project does not belong to that client.", "error");
      return;
    }
    BXCore.setButtonLoading(submitBtn, true, "Saving...");

    const taskId = "task_" + Date.now();
    const title = String(fd.get("title") || "").trim();
    const description = String(fd.get("description") || "").trim();
    const assignee = String(fd.get("assignee") || "bx-media").trim();
    const status = String(fd.get("status") || "in-progress").trim();
    const progress = Number(fd.get("progress") || 0);
    const dueDate = String(fd.get("dueDate") || "").trim();
    const normalizedDueDate = dueDate ? dueDate : null;
    let parentTaskId = null;
    const finalTitle = title;
    if (!finalTitle) {
      showActionStatus("Please enter a task title.", "error");
      BXCore.setButtonLoading(submitBtn, false);
      return;
    }
    if (taskType === "subtask") {
      parentTaskId = mainSelection || null;
    }

    const projectTasks = tasks.filter((t) => t.projectId === projectId);
    const scopedTasks = parentTaskId
      ? projectTasks.filter((t) => getParentTaskId(t) === parentTaskId)
      : projectTasks.filter((t) => isMainTask(t));
    const scopedMaxOrder = scopedTasks.reduce((max, t) => {
      const val = getTaskOrderValue(t);
      return Number.isFinite(val) ? Math.max(max, val) : max;
    }, 0);

    try {
      const resp = await BXCore.apiPost({
        action: "addTask",
        taskId,
        projectId,
        title: finalTitle,
        description,
        assignee,
        status,
        progress: Number.isFinite(progress) ? progress : 0,
        dueDate: normalizedDueDate,
        taskOrder: scopedMaxOrder + 1,
        order_index: scopedMaxOrder + 1,
        parentTaskId,
        parent_task_id: parentTaskId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (!resp.ok) throw new Error(resp.error || "Create failed");

      e.target.reset();
      populateAddTaskProjectSelect();
      if (addTaskStatus) {
        addTaskStatus.textContent = "Task added successfully.";
        addTaskStatus.style.display = "block";
        setTimeout(() => (addTaskStatus.style.display = "none"), 2000);
      }
      showActionStatus("Task saved. The list is refreshed.", "success");
      closeAddTaskModal();

      data = await BXCore.apiGetAll(true);
      BXCore.updateSidebarStats(data);
      projects = data.projects || [];
      tasks = pruneOrphanedSubtasks(data.tasks || []);
      populateProjectSelects();
      populateAddTaskClientSelect();
      populateAddTaskProjectSelect();
      populateAddTaskMainSelect(addTaskProjectSelect?.value);
      renderTasks();
    } catch (err) {
      console.error(err);
      showActionStatus("Couldn't save the task. Please try again.", "error");
    } finally {
      BXCore.setButtonLoading(submitBtn, false);
    }
  });

  populateClientSelect();
  populateProjectSelects();
  populateAddTaskClientSelect();
  populateAddTaskProjectSelect();
  populateAddTaskMainSelect(addTaskProjectSelect?.value);

  if (quickProjectId) {
    const quickProject = projects.find((p) => p.projectId === quickProjectId);
    if (quickProject) {
      if (addTaskClientSelect) {
        addTaskClientSelect.value = quickProject.clientId;
      }
      populateAddTaskProjectSelect(quickProjectId);
      openAddTaskModal();
    }
  }

  renderTasks();
});
