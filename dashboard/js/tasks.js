
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
  let tasks = data.tasks || [];
  let currentEditTask = null;

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

  function getTaskOrderValue(task) {
    const val = Number(task.taskOrder);
    if (Number.isFinite(val)) return val;
    const fallback = new Date(task.updatedAt || task.createdAt || 0).getTime();
    return Number.isFinite(fallback) ? fallback : Number.MAX_SAFE_INTEGER;
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

    let filtered = tasks.slice();
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
      const canReorder = isAdmin && useOrder;

      filtered
        .slice()
        .sort((a, b) => {
          if (useOrder) {
            const orderDiff = getTaskOrderValue(a) - getTaskOrderValue(b);
            if (orderDiff !== 0) return orderDiff;
          } else {
            const projectA = getProjectNameForTask(a).toLowerCase();
            const projectB = getProjectNameForTask(b).toLowerCase();
            const projectDiff = projectA.localeCompare(projectB);
            if (projectDiff !== 0) return projectDiff;
            const orderDiff = getTaskOrderValue(a) - getTaskOrderValue(b);
            if (orderDiff !== 0) return orderDiff;
          }
          return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
        })
      .forEach((t) => {
        const clientName = getClientNameForTask(t);
        const projectName = getProjectNameForTask(t);
        const statusValue = t.status || "not-started";
        const dueLabel = BXCore.formatDate(t.dueDate) || "TBD";
        const assigneeLabel = t.assignee === "client" ? "Client" : "BX Media";
        const card = document.createElement("article");
        card.className = "task-card";
        card.dataset.taskId = t.taskId;
        card.draggable = canReorder;
        card.innerHTML = `
          <header class="task-card-header">
            <div>
              <h3>${t.title || "Untitled task"}</h3>
              <p class="task-card-meta">
                <span>${projectName}</span>
                <span class="task-card-sep">&gt;</span>
                <span>${clientName}</span>
              </p>
            </div>
            <div class="task-card-controls">
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
              <div class="task-static">${t.progress || 0}%</div>
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
              <div class="task-static">${BXCore.formatDateTime(t.updatedAt)}</div>
            </div>
          </div>
        `;
        wrap.appendChild(card);
      });

    if (isAdmin) {
      wrap.addEventListener("click", async (e) => {
        const card = e.target.closest("article.task-card");
        if (!card) return;
        const taskId = card.dataset.taskId;

        const openBtn = e.target.closest(".task-edit-open");
        if (!openBtn) return;
        const task = tasks.find((item) => item.taskId === taskId);
        if (task) openTaskModal(task);
      });
    }

    if (canReorder) {
      let dragCard = null;
      let dragDidDrop = false;
      const getCardAfter = (container, y) => {
        const cards = [...container.querySelectorAll(".task-card:not(.is-dragging)")];
        return cards.reduce(
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
      const saveOrder = async () => {
        const orderedIds = [...wrap.querySelectorAll(".task-card")].map((el) => el.dataset.taskId);
        const updates = orderedIds.map((taskId, index) => ({
          taskId,
          taskOrder: index + 1,
        }));
        updates.forEach((u) => {
          const task = tasks.find((t) => t.taskId === u.taskId);
          if (task) task.taskOrder = u.taskOrder;
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

      wrap.addEventListener("dragstart", (e) => {
        const card = e.target.closest(".task-card");
        if (!card || !e.target.closest(".task-drag-handle")) {
          e.preventDefault();
          return;
        }
        dragCard = card;
        dragDidDrop = false;
        card.classList.add("is-dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", card.dataset.taskId || "");
      });

      wrap.addEventListener("dragover", (e) => {
        e.preventDefault();
        const card = e.target.closest(".task-card");
        wrap.querySelectorAll(".task-card").forEach((el) => el.classList.remove("is-drag-over"));
        if (card && card !== dragCard) card.classList.add("is-drag-over");
        const after = getCardAfter(wrap, e.clientY);
        if (!dragCard) return;
        if (after == null) {
          wrap.appendChild(dragCard);
        } else {
          wrap.insertBefore(dragCard, after);
        }
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
      });

      wrap.addEventListener("pointerdown", (e) => {
        const handle = e.target.closest(".task-drag-handle");
        if (!handle) return;
        const card = handle.closest(".task-card");
        if (!card) return;
        e.preventDefault();
        dragCard = card;
        card.classList.add("is-dragging");
        const onMove = (ev) => {
          const target = document.elementFromPoint(ev.clientX, ev.clientY);
          const hover = target ? target.closest(".task-card") : null;
          wrap.querySelectorAll(".task-card").forEach((el) => el.classList.remove("is-drag-over"));
          if (hover && hover !== dragCard) hover.classList.add("is-drag-over");
          const after = getCardAfter(wrap, ev.clientY);
          if (!dragCard) return;
          if (after == null) {
            wrap.appendChild(dragCard);
          } else {
            wrap.insertBefore(dragCard, after);
          }
        };
        const onUp = async () => {
          document.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerup", onUp);
          wrap.querySelectorAll(".task-card").forEach((el) => {
            el.classList.remove("is-dragging", "is-drag-over");
          });
          await saveOrder();
          dragCard = null;
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
        const resp = await BXCore.apiPost({ action: "deleteTask", taskId: currentEditTask.taskId });
        if (!resp.ok) throw new Error(resp.error || "Delete failed");
        data = await BXCore.apiGetAll(true);
        BXCore.updateSidebarStats(data);
        projects = data.projects || [];
        tasks = data.tasks || [];
        closeTaskModal();
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
        tasks = data.tasks || [];
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
      tasks = data.tasks || [];
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
