
document.addEventListener("DOMContentLoaded", async () => {
  const sess = BXCore.requireAuth({ role: "admin" });
  if (!sess) return;

  const isAdmin = sess.role === "admin";

  const clientRow = document.getElementById("tasksClientRow");
  const clientSelect = document.getElementById("tasksClientSelect");
  const projectSelect = document.getElementById("tasksProjectSelect");
  const statusFilter = document.getElementById("tasksStatusFilter");
  const assigneeFilter = document.getElementById("tasksAssigneeFilter");
  const addTaskProjectSelect = document.getElementById("addTaskProjectSelect");
  const addTaskClientSelect = document.getElementById("addTaskClientSelect");
  const addTaskStatus = document.getElementById("addTaskStatus");
  const tasksTableWrapper = document.getElementById("tasksTableWrapper");
  const actionStatusEl = document.getElementById("tasksActionStatus");
  const toggleAddTaskBtn = document.getElementById("toggleAddTask");
  const addTaskPanel = document.getElementById("addTaskPanel");
  const openAddTaskInline = document.getElementById("openAddTaskInline");
  const cancelAddTaskBtn = document.getElementById("cancelAddTask");
  const taskEditModal = document.getElementById("taskEditModal");
  const taskEditMeta = document.getElementById("taskEditMeta");
  const taskEditForm = document.getElementById("taskEditForm");
  const taskEditTitle = document.getElementById("taskEditTitle");
  const taskEditDescription = document.getElementById("taskEditDescription");
  const taskEditAssignee = document.getElementById("taskEditAssignee");
  const taskEditStatus = document.getElementById("taskEditStatus");
  const taskEditProject = document.getElementById("taskEditProject");
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
  const expandedTaskIds = new Set();

  let currentClientId = null;
  let currentProjectId = null;
  const quickProjectId = new URLSearchParams(window.location.search).get("projectId");

  if (!isAdmin) {
    if (clientRow) clientRow.style.display = "none";
    const client =
      clients.find((c) => c.clientId === sess.clientId) ||
      clients.find((c) => c.username === sess.username);
    currentClientId = client?.clientId || null;
  }

  if (toggleAddTaskBtn && addTaskPanel) {
    toggleAddTaskBtn.addEventListener("click", () => {
      const isCollapsed = addTaskPanel.classList.toggle("is-collapsed");
      toggleAddTaskBtn.textContent = isCollapsed ? "Show" : "Hide";
      addTaskPanel.setAttribute("aria-hidden", isCollapsed ? "true" : "false");
    });
  }

  if (openAddTaskInline && addTaskPanel) {
    openAddTaskInline.addEventListener("click", () => {
      addTaskPanel.classList.remove("is-collapsed");
      addTaskPanel.setAttribute("aria-hidden", "false");
      if (toggleAddTaskBtn) toggleAddTaskBtn.textContent = "Hide";
      addTaskPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (cancelAddTaskBtn && addTaskPanel) {
    cancelAddTaskBtn.addEventListener("click", () => {
      addTaskPanel.classList.add("is-collapsed");
      addTaskPanel.setAttribute("aria-hidden", "true");
      if (toggleAddTaskBtn) toggleAddTaskBtn.textContent = "Show";
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
      return;
    }

    const visibleProjects = projects.filter((p) => p.clientId === clientId);
    if (!visibleProjects.length) {
      addTaskProjectSelect.disabled = true;
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No projects for this client";
      addTaskProjectSelect.appendChild(opt);
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
    const val = Number(task.taskOrder);
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
    [...expandedTaskIds].forEach((taskId) => {
      if (!mainIds.has(taskId)) expandedTaskIds.delete(taskId);
    });
  }

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
      if (emptyAddBtn) {
        emptyAddBtn.addEventListener("click", () => {
          if (!addTaskPanel) return;
          addTaskPanel.classList.remove("is-collapsed");
          addTaskPanel.setAttribute("aria-hidden", "false");
          if (toggleAddTaskBtn) toggleAddTaskBtn.textContent = "Hide";
          addTaskPanel.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
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
    wrap.className = "task-cards";
    const useOrder = projectSelect.value !== "all";
    const canReorder = isAdmin;
    const subtaskMap = new Map();
    filtered.forEach((task) => {
      const parentId = getParentTaskId(task);
      if (!parentId) return;
      if (!subtaskMap.has(parentId)) subtaskMap.set(parentId, []);
      subtaskMap.get(parentId).push(task);
    });
    const filteredTaskIds = new Set(filtered.map((task) => task.taskId));
    const mainTasks = derivedTasks
      .filter(isMainTask)
      .filter((task) => filteredTaskIds.has(task.taskId) || subtaskMap.has(task.taskId));
    const orderedMainTasks = sortMainTasks(mainTasks);
    keepExpandedIdsFor(mainTasks);

    const sortSubtasksForParent = (parentTitle, list) => {
      if (hasManualOrder(list)) return sortByManualOrder(list);
      const subOrder = SUBTASK_ORDER[normalizeTaskTitle(parentTitle)] || [];
      const subOrderMap = buildOrderMap(subOrder);
      return sortByExplicitOrder(list, subOrderMap);
    };

    const buildTaskCard = (task, options = {}) => {
      const clientName = getClientNameForTask(task);
      const projectName = getProjectNameForTask(task);
      const statusValue = task.status || "not-started";
      const dueLabel = BXCore.formatDate(task.dueDate) || "TBD";
      const assigneeLabel = task.assignee === "client" ? "Client" : "BX Media";
      const card = document.createElement("article");
      card.className = "task-card";
      if (options.isSubtask) card.classList.add("is-subtask");
      card.dataset.taskId = task.taskId;
      card.dataset.taskRole = options.isSubtask ? "subtask" : "main";
      if (options.isSubtask && options.parentTaskId) {
        card.dataset.parentTaskId = options.parentTaskId;
      }
      card.draggable = Boolean(canReorder);
      if (canReorder) card.classList.add("is-draggable");

      const toggleMarkup = options.showToggle
        ? `
          <button
            class="btn-secondary btn-compact task-expand-toggle"
            type="button"
            data-task-id="${task.taskId}"
            aria-expanded="${options.isExpanded ? "true" : "false"}"
            aria-label="${options.isExpanded ? "Collapse" : "Expand"} subtasks" title="${options.isExpanded ? "Collapse" : "Expand"} subtasks"
            ${options.subtaskCount ? "" : "disabled"}
          >
            <i class="fas fa-chevron-${options.isExpanded ? "down" : "right"}"></i>
            <span class="task-toggle-count">${options.subtaskCount ? options.subtaskCount : 0}</span>
          </button>
        `
        : "";

      card.innerHTML = `
        <header class="task-card-header">
          <div>
            <h3>${task.title || "Untitled task"}</h3>
            <p class="task-card-meta">
              <span>${projectName}</span>
              <span class="task-card-sep">&gt;</span>
              <span>${clientName}</span>
            </p>
          </div>
          <div class="task-card-controls">
            ${toggleMarkup}
            ${canReorder ? `<span class="task-drag-handle" title="Drag to reorder"><i class="fas fa-grip-lines"></i></span>` : ""}
            <span class="badge ${statusValue}">${statusValue.replace("-", " ")}</span>
            ${
              isAdmin
                ? `<button class="btn-secondary btn-compact task-edit-open" type="button">Edit</button>`
                : ""
            }
          </div>
        </header>
        <div class="task-card-grid task-view">
          <div class="form-row">
            <label>Project</label>
            <div class="task-static">${projectName}</div>
          </div>
          <div class="form-row">
            <label>Progress</label>
            ${options.isSubtask ? `<div class="task-static">${task.progress || 0}%</div>` : `
              <div class="task-progress">
                <progress max="100" value="${Math.max(0, Math.min(100, Number(task.progress || 0)))}"></progress>
                <span>${task.progress || 0}%</span>
              </div>
            `}
          </div>
          <div class="form-row">
            <label>Due date</label>
            <div class="task-static">${dueLabel}</div>
          </div>
          <div class="form-row">
            <label>Assignee</label>
            <div class="task-static">${assigneeLabel}</div>
          </div>
          <div class="form-row">
            <label>Updated</label>
            <div class="task-static">${BXCore.formatDateTime(task.updatedAt)}</div>
          </div>
        </div>
      `;
      return card;
    };

    orderedMainTasks.forEach((task) => {
      const subtasks = subtaskMap.get(task.taskId) || [];
      const isExpanded = expandedTaskIds.has(task.taskId);
      const mainCard = buildTaskCard(task, {
        showToggle: true,
        subtaskCount: subtasks.length,
        isExpanded,
      });
      wrap.appendChild(mainCard);
      if (isExpanded && subtasks.length) {
        sortSubtasksForParent(task.title, subtasks).forEach((subtask) => {
          const subtaskCard = buildTaskCard(subtask, {
            isSubtask: true,
            parentTaskId: task.taskId,
          });
          wrap.appendChild(subtaskCard);
        });
      }
    });

    wrap.addEventListener("click", (e) => {
      const toggle = e.target.closest(".task-expand-toggle");
      if (!toggle) return;
      const taskId = toggle.dataset.taskId;
      if (!taskId) return;
      if (expandedTaskIds.has(taskId)) {
        expandedTaskIds.delete(taskId);
      } else {
        expandedTaskIds.add(taskId);
      }
      renderTasks();
    });

    if (isAdmin) {
      wrap.addEventListener("click", async (e) => {
        const card = e.target.closest("article.task-card");
        if (!card) return;
        const taskId = card.dataset.taskId;

        const openBtn = e.target.closest(".task-edit-open");
        if (!openBtn) return;
        const task = derivedTasks.find((item) => item.taskId === taskId);
        if (task) openTaskModal(task);
      });
    }
    if (canReorder) {
      let dragCard = null;
      let dragDidDrop = false;
      let dragRole = null;
      let dragParentId = null;

      const isInteractiveElement = (target) =>
        Boolean(target.closest("button, a, input, select, textarea"));

      const isDragHandle = (target) => Boolean(target.closest(".task-drag-handle"));

      const getEligibleCards = () => {
        if (!dragRole) return [];
        if (dragRole === "main") {
          return [
            ...wrap.querySelectorAll('.task-card[data-task-role="main"]:not(.is-dragging)'),
          ];
        }
        return [
          ...wrap.querySelectorAll(
            `.task-card[data-task-role="subtask"][data-parent-task-id="${dragParentId}"]:not(.is-dragging)`
          ),
        ];
      };

      const getCardAfter = (container, y, cards) => {
        return (cards || []).reduce(
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
      };

      const insertDragCard = (after, eligibleCards) => {
        if (!dragCard) return;
        if (!eligibleCards.length) return;
        if (after == null) {
          const last = eligibleCards[eligibleCards.length - 1];
          if (last && last.nextSibling) {
            wrap.insertBefore(dragCard, last.nextSibling);
          } else {
            wrap.appendChild(dragCard);
          }
        } else {
          wrap.insertBefore(dragCard, after);
        }
      };

      const saveOrder = async () => {
        const updates = [];
        const mainCards = [...wrap.querySelectorAll('.task-card[data-task-role="main"]')];
        mainCards.forEach((card, index) => {
          updates.push({ taskId: card.dataset.taskId, taskOrder: index + 1 });
        });

        const subtaskGroups = new Map();
        wrap.querySelectorAll('.task-card[data-task-role="subtask"]').forEach((card) => {
          const parentId = card.dataset.parentTaskId;
          if (!parentId) return;
          if (!subtaskGroups.has(parentId)) subtaskGroups.set(parentId, []);
          subtaskGroups.get(parentId).push(card);
        });
        subtaskGroups.forEach((cards) => {
          cards.forEach((card, index) => {
            updates.push({ taskId: card.dataset.taskId, taskOrder: index + 1 });
          });
        });

        const updateMap = new Map(updates.map((u) => [u.taskId, u.taskOrder]));
        tasks = tasks.map((task) => {
          if (!updateMap.has(task.taskId)) return task;
          return { ...task, taskOrder: updateMap.get(task.taskId) };
        });

        try {
          const responses = await Promise.all(
            updates.map((u) =>
              BXCore.apiPost({
                action: "updateTask",
                taskId: u.taskId,
                taskOrder: u.taskOrder,
              })
            )
          );
          const failed = responses.find((resp) => !resp?.ok);
          if (failed) throw new Error(failed.error || "Update failed");
          BXCore.showToast("Task order updated.", "success");
        } catch (err) {
          console.error(err);
          BXCore.showToast("Couldn't save task order. Please try again.", "error");
        } finally {
          renderTasks();
        }
      };

      const beginDrag = (card) => {
        dragCard = card;
        dragRole = card.dataset.taskRole;
        dragParentId = card.dataset.parentTaskId || null;
        dragDidDrop = false;
        card.classList.add("is-dragging");
      };

      wrap.addEventListener("dragstart", (e) => {
        const card = e.target.closest(".task-card");
        if (!card) return;
        if (isInteractiveElement(e.target) || !isDragHandle(e.target)) {
          e.preventDefault();
          return;
        }
        beginDrag(card);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", card.dataset.taskId || "");
      });

      wrap.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (!dragCard) return;
        const eligibleCards = getEligibleCards();
        if (!eligibleCards.length) return;
        const hover = e.target.closest(".task-card");
        wrap.querySelectorAll(".task-card").forEach((el) => el.classList.remove("is-drag-over"));
        if (hover && hover !== dragCard && eligibleCards.includes(hover)) {
          hover.classList.add("is-drag-over");
        }
        const after = getCardAfter(wrap, e.clientY, eligibleCards);
        insertDragCard(after, eligibleCards);
      });

      wrap.addEventListener("drop", async (e) => {
        e.preventDefault();
        if (!dragCard) return;
        dragDidDrop = true;
        await saveOrder();
      });

      wrap.addEventListener("dragend", () => {
        wrap.querySelectorAll(".task-card").forEach((el) => {
          el.classList.remove("is-dragging", "is-drag-over");
        });
        if (dragCard && !dragDidDrop) {
          saveOrder();
        }
        dragCard = null;
        dragDidDrop = false;
        dragRole = null;
        dragParentId = null;
      });

      wrap.addEventListener("pointerdown", (e) => {
        const card = e.target.closest(".task-card");
        if (!card) return;
        if (isInteractiveElement(e.target) || !isDragHandle(e.target)) return;
        e.preventDefault();
        beginDrag(card);
        const onMove = (ev) => {
          const target = document.elementFromPoint(ev.clientX, ev.clientY);
          const hover = target ? target.closest(".task-card") : null;
          const eligibleCards = getEligibleCards();
          if (!eligibleCards.length) return;
          wrap.querySelectorAll(".task-card").forEach((el) => el.classList.remove("is-drag-over"));
          if (hover && hover !== dragCard && eligibleCards.includes(hover)) {
            hover.classList.add("is-drag-over");
          }
          const after = getCardAfter(wrap, ev.clientY, eligibleCards);
          insertDragCard(after, eligibleCards);
        };
        const onUp = async () => {
          document.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerup", onUp);
          wrap.querySelectorAll(".task-card").forEach((el) => {
            el.classList.remove("is-dragging", "is-drag-over");
          });
          await saveOrder();
          dragCard = null;
          dragRole = null;
          dragParentId = null;
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

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && taskEditModal?.classList.contains("is-open")) {
      closeTaskModal();
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
    if (!clientId) {
      showActionStatus("Please select a client before adding a task.", "error");
      return;
    }
    if (!projectId) {
      showActionStatus("Please select a project before adding a task.", "error");
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
    const projectTasks = tasks.filter((t) => t.projectId === projectId);
    const maxOrder = projectTasks.reduce((max, t) => {
      const val = Number(t.taskOrder);
      return Number.isFinite(val) ? Math.max(max, val) : max;
    }, 0);

    try {
      const resp = await BXCore.apiPost({
        action: "addTask",
        taskId,
        projectId,
        title,
        description,
        assignee,
        status,
        progress: Number.isFinite(progress) ? progress : 0,
        dueDate: normalizedDueDate,
        taskOrder: maxOrder + 1,
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

      data = await BXCore.apiGetAll(true);
      BXCore.updateSidebarStats(data);
      projects = data.projects || [];
      tasks = pruneOrphanedSubtasks(data.tasks || []);
      populateProjectSelects();
      populateAddTaskClientSelect();
      populateAddTaskProjectSelect();
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

  if (quickProjectId) {
    const quickProject = projects.find((p) => p.projectId === quickProjectId);
    if (quickProject) {
      if (addTaskClientSelect) {
        addTaskClientSelect.value = quickProject.clientId;
      }
      populateAddTaskProjectSelect(quickProjectId);
      if (addTaskPanel) {
        addTaskPanel.classList.remove("is-collapsed");
        addTaskPanel.setAttribute("aria-hidden", "false");
        if (toggleAddTaskBtn) toggleAddTaskBtn.textContent = "Hide";
        addTaskPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  renderTasks();
});
