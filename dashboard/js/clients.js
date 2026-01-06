document.addEventListener("DOMContentLoaded", async () => {
  // Require admin login
  const sess = BXCore.requireAuth({ role: "admin" });
  if (!sess) return;

  const statusEl = document.getElementById("addClientStatus");
  const actionStatusEl = document.getElementById("clientsActionStatus");
  const clientsTableWrapper = document.getElementById("clientsTableWrapper");
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

  /* ---------------------------------------------------------
     RENDER CLIENTS TABLE
  --------------------------------------------------------- */
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

    clientsTableWrapper.innerHTML = "";

    if (!clients.length) {
      clientsTableWrapper.innerHTML = '<div class="empty">No clients found.</div>';
      return;
    }

    const tableWrap = document.createElement("div");
    tableWrap.className = "table-wrapper";

    const table = document.createElement("table");
    table.innerHTML = `
      <thead>
        <tr>
          <th>Client</th>
          <th>Username</th>
          <th>Status</th>
          <th>Projects</th>
          <th>Tasks</th>
          <th>Manage</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");

    clients.forEach((c) => {
      const clientProjects = projects.filter((p) => p.clientId === c.clientId);
      const clientTasks = tasks.filter((t) =>
        clientProjects.some((p) => p.projectId === t.projectId)
      );

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${c.clientName || "Unknown"}</strong></td>
        <td>${c.username || "Unknown"}</td>
        <td><span class="badge ${c.status || "active"}">${(c.status || "active").replace("-", " ")}</span></td>
        <td>${clientProjects.length}</td>
        <td>${clientTasks.length}</td>
        <td>
          <button class="btn-secondary btn-compact" data-manage="${c.clientId}">
            <i class="fas fa-gear"></i> Manage
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Delete button handler
    tableWrap.appendChild(table);
    clientsTableWrapper.appendChild(tableWrap);
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
      detailSubtitle.textContent = `${clientProjects.length} projects, ${clientTasks.length} tasks for this client.`;

    const projectNameById = clientProjects.reduce((map, p) => {
      map[p.projectId] = p.name || p.projectId || "Project";
      return map;
    }, {});
    const tasksByProject = clientProjects.map((project) => {
      const list = clientTasks.filter((t) => t.projectId === project.projectId);
      const ordered = list
        .slice()
        .sort((a, b) => {
          const aOrder = Number.isFinite(Number(a.taskOrder)) ? Number(a.taskOrder) : Number.MAX_SAFE_INTEGER;
          const bOrder = Number.isFinite(Number(b.taskOrder)) ? Number(b.taskOrder) : Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
        });
      return { project, tasks: ordered };
    });

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
      <div class="client-lists">
        <div class="client-list">
          <h3>Projects</h3>
          ${
            clientProjects.length
              ? `<ul>${clientProjects
                  .map(
                    (p) =>
                      `<li><span>${p.name || "Untitled"}</span><span class="badge ${p.status ||
                        "not-started"}">${(p.status || "not-started").replace("-", " ")}</span></li>`
                  )
                  .join("")}</ul>`
              : "<p class='empty'>No projects yet.</p>"
          }
        </div>
        <div class="client-list">
          <h3>Tasks</h3>
          ${
            clientTasks.length
              ? tasksByProject
                  .map(({ project, tasks }) => {
                    if (!tasks.length) return "";
                    const projectLabel = projectNameById[project.projectId] || "Project";
                    return `
                      <div class="client-task-project" data-project-id="${project.projectId}">
                        <div class="client-task-project-title">${projectLabel}</div>
                        <ul class="client-task-list" data-project-id="${project.projectId}">
                          ${tasks
                            .map((t) => {
                              const status = t.status || "not-started";
                              return `
                                <li class="client-task-row" data-task-id="${t.taskId}" data-project-id="${t.projectId}">
                                  <button class="task-drag-handle" type="button" aria-label="Drag to reorder">
                                    <i class="fas fa-grip-lines"></i>
                                  </button>
                                  <div class="client-task-copy">
                                    <span class="client-task-title">${t.title || "Untitled task"}</span>
                                  </div>
                                  <span class="badge ${status}">${status.replace("-", " ")}</span>
                                </li>
                              `;
                            })
                            .join("")}
                        </ul>
                      </div>
                    `;
                  })
                  .join("")
              : "<p class='empty'>No tasks yet.</p>"
          }
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

    detailBody.querySelectorAll(".client-task-list").forEach((list) => {
      const projectId = list.dataset.projectId;
      bindClientTaskOrdering(list, projectId);
    });

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

  function bindClientTaskOrdering(listEl, projectId) {
    let dragItem = null;
    let dragDidDrop = false;
    const getAfterElement = (container, y) => {
      const items = [...container.querySelectorAll(".client-task-row:not(.is-dragging)")];
      return items.reduce(
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

    listEl.querySelectorAll(".client-task-row").forEach((row) => {
      row.setAttribute("draggable", "true");
    });
    const saveOrder = async () => {
      const ordered = [...listEl.querySelectorAll(".client-task-row")];
      const updates = ordered.map((row, index) => ({
        taskId: row.dataset.taskId,
        taskOrder: index + 1,
        projectId,
      }));

      updates.forEach((update) => {
        const task = tasks.find((t) => t.taskId === update.taskId);
        if (task) task.taskOrder = update.taskOrder;
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
        listEl.querySelectorAll(".client-task-row").forEach((row) => {
          row.classList.remove("is-dragging", "is-drag-over");
        });
        dragItem = null;
      }
    };

    listEl.addEventListener("dragstart", (e) => {
      const row = e.target.closest(".client-task-row");
      if (!row || !e.target.closest(".task-drag-handle")) {
        e.preventDefault();
        return;
      }
      dragItem = row;
      dragDidDrop = false;
      row.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", row.dataset.taskId || "");
    });

    listEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      const row = e.target.closest(".client-task-row");
      listEl.querySelectorAll(".client-task-row").forEach((el) => el.classList.remove("is-drag-over"));
      if (row && row !== dragItem) row.classList.add("is-drag-over");
      const after = getAfterElement(listEl, e.clientY);
      if (!dragItem) return;
      if (after == null) {
        listEl.appendChild(dragItem);
      } else {
        listEl.insertBefore(dragItem, after);
      }
    });

    listEl.addEventListener("drop", async (e) => {
      e.preventDefault();
      if (!dragItem) return;
      dragDidDrop = true;
      await saveOrder();
    });

    listEl.addEventListener("dragend", () => {
      listEl.querySelectorAll(".client-task-row").forEach((row) => {
        row.classList.remove("is-dragging", "is-drag-over");
      });
      if (dragItem && !dragDidDrop) {
        saveOrder();
      }
      dragItem = null;
      dragDidDrop = false;
    });

    listEl.addEventListener("pointerdown", (e) => {
      const handle = e.target.closest(".task-drag-handle");
      if (!handle) return;
      const row = handle.closest(".client-task-row");
      if (!row) return;
      e.preventDefault();
      dragItem = row;
      row.classList.add("is-dragging");
      const onMove = (ev) => {
        const target = document.elementFromPoint(ev.clientX, ev.clientY);
        const hover = target ? target.closest(".client-task-row") : null;
        listEl.querySelectorAll(".client-task-row").forEach((el) => el.classList.remove("is-drag-over"));
        if (hover && hover !== dragItem) hover.classList.add("is-drag-over");
        const after = getAfterElement(listEl, ev.clientY);
        if (!dragItem) return;
        if (after == null) {
          listEl.appendChild(dragItem);
        } else {
          listEl.insertBefore(dragItem, after);
        }
      };
      const onUp = async () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        await saveOrder();
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp, { once: true });
    });
  }

  /* ---------------------------------------------------------
     ADD CLIENT HANDLER
  --------------------------------------------------------- */
  document.getElementById("addClientForm").addEventListener("submit", async (e) => {
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
      const manageBtn = e.target.closest("button[data-manage]");

      if (manageBtn) {
        const clientId = manageBtn.getAttribute("data-manage");
        const client = clients.find((c) => c.clientId === clientId);
        const clientProjects = projects.filter((p) => p.clientId === clientId);
        const clientTasks = tasks.filter((t) =>
          clientProjects.some((p) => p.projectId === t.projectId)
        );
        renderClientDetail(client, clientProjects, clientTasks, { focusEdit: true });
      }
    });
  }
});
