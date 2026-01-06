// BX Media Dashboard Core Logic
// Shared helpers: API, auth, utilities, sidebar wiring

(function() {
  const SESSION_KEY = "bxm_dashboard_session_v1";
  let cachedData = null;
  let firstLoadPending = true;
  let supabaseClient = null;

  function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;
    if (window.BXSupabase?.client) {
      supabaseClient = window.BXSupabase.client;
      return supabaseClient;
    }
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("Supabase client library not loaded");
    }
    supabaseClient = window.supabase.createClient(
      "https://lhtqlftxctxjguxhzvxq.supabase.co",
      "sb_publishable_3jTA4mBXkPdSESdaDarYdA_GGx-hh8h"
    );
    return supabaseClient;
  }

  function ensurePageLoader() {
    if (document.getElementById("pageLoader")) return;
    const mount = () => {
      if (document.getElementById("pageLoader")) return;
      const loader = document.createElement("div");
      loader.id = "pageLoader";
      loader.className = "page-loader";
      loader.innerHTML = `
        <div class="loader-skeleton" aria-hidden="true">
          <div class="skeleton skeleton-line" style="width:48%"></div>
          <div class="loader-bar"></div>
        </div>
        <div class="message" role="status" aria-live="polite">Loading...</div>
      `;
      document.body.appendChild(loader);
    };
    if (document.body) {
      mount();
    } else {
      document.addEventListener("DOMContentLoaded", mount);
    }
  }

  function showPageLoader(message) {
    ensurePageLoader();
    const loader = document.getElementById("pageLoader");
    if (!loader) return;
    const msg = loader.querySelector(".message");
    if (msg) msg.textContent = message || "Loading...";
    loader.classList.add("is-visible");
  }

  function hidePageLoader() {
    const loader = document.getElementById("pageLoader");
    if (!loader) return;
    loader.classList.remove("is-visible");
  }

  function setButtonLoading(btn, isLoading, loadingText) {
    if (!btn) return;
    const labelEl = btn.querySelector(".btn-text");
    if (!btn.dataset.defaultLabel) {
      if (labelEl) {
        btn.dataset.defaultLabel = labelEl.textContent.trim();
      } else {
        btn.dataset.defaultLabel = btn.textContent.trim();
      }
    }
    if (isLoading) {
      const nextLabel = loadingText || "Loading...";
      if (labelEl) {
        labelEl.textContent = nextLabel;
      } else {
        btn.textContent = nextLabel;
      }
    } else {
      const restore = btn.dataset.defaultLabel || "Submit";
      if (labelEl) {
        labelEl.textContent = restore;
      } else {
        btn.textContent = restore;
      }
    }
    btn.disabled = !!isLoading;
    btn.classList.toggle("is-loading", !!isLoading);
    btn.setAttribute("aria-busy", isLoading ? "true" : "false");
  }

  function ensureToastContainer() {
    let stack = document.getElementById("toastStack");
    if (stack) return stack;
    stack = document.createElement("div");
    stack.id = "toastStack";
    stack.className = "toast-stack";
    stack.setAttribute("aria-live", "polite");
    stack.setAttribute("aria-atomic", "false");
    document.body.appendChild(stack);
    return stack;
  }

  function showToast(message, type = "info", options = {}) {
    if (!message) return;
    const stack = ensureToastContainer();
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.setAttribute("role", "status");
    toast.innerHTML = `
      <div class="toast-body">${message}</div>
      <button class="toast-close" type="button" aria-label="Dismiss">Dismiss</button>
    `;
    stack.appendChild(toast);

    const close = () => {
      toast.classList.add("is-leaving");
      setTimeout(() => toast.remove(), 220);
    };

    toast.querySelector(".toast-close").addEventListener("click", close);

    const ttl = Number.isFinite(options.duration) ? options.duration : 3200;
    if (ttl > 0) {
      setTimeout(close, ttl);
    }
  }

  function ensureConfirmModal() {
    let modal = document.getElementById("confirmModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "confirmModal";
    modal.className = "modal confirm-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `
      <div class="modal-backdrop" data-modal-close></div>
      <div class="modal-panel">
        <div class="modal-header">
          <div>
            <h2 id="confirmModalTitle">Confirm action</h2>
            <p id="confirmModalMessage" class="modal-helper"></p>
          </div>
          <button class="ghost" type="button" data-modal-close>Close</button>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" type="button" data-modal-cancel>Cancel</button>
          <button class="btn-danger" type="button" data-modal-confirm>Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function confirmAction(options = {}) {
    const modal = ensureConfirmModal();
    const titleEl = modal.querySelector("#confirmModalTitle");
    const messageEl = modal.querySelector("#confirmModalMessage");
    const confirmBtn = modal.querySelector("[data-modal-confirm]");
    const cancelBtn = modal.querySelector("[data-modal-cancel]");

    titleEl.textContent = options.title || "Confirm action";
    messageEl.textContent = options.message || "Are you sure you want to continue?";
    confirmBtn.textContent = options.confirmLabel || "Confirm";
    confirmBtn.className = options.tone === "danger" ? "btn-danger" : "btn-primary";

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    return new Promise((resolve) => {
      const close = (result) => {
        modal.removeEventListener("click", onBackdrop);
        cancelBtn.removeEventListener("click", onCancel);
        confirmBtn.removeEventListener("click", onConfirm);
        document.removeEventListener("keydown", onEsc);
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
        resolve(result);
      };

      const onBackdrop = (e) => {
        if (e.target.closest("[data-modal-close]")) close(false);
      };
      const onCancel = () => close(false);
      const onConfirm = () => close(true);
      const onEsc = (e) => {
        if (e.key === "Escape") close(false);
      };

      modal.addEventListener("click", onBackdrop);
      cancelBtn.addEventListener("click", onCancel);
      confirmBtn.addEventListener("click", onConfirm);
      document.addEventListener("keydown", onEsc);
    });
  }

  function renderSkeleton(container, type, count = 3) {
    if (!container) return;
    container.innerHTML = "";
    const classes = ["skeleton", `skeleton-${type}`];
    for (let i = 0; i < count; i += 1) {
      const item = document.createElement("div");
      item.className = classes.join(" ");
      container.appendChild(item);
    }
  }

  function unwrapBody(obj) {
    if (obj && typeof obj === "object" && "body" in obj && obj.body) return obj.body;
    return obj;
  }

  function logSessionStatus() {
    const sess = getLocalSession();
    if (sess) {
      console.log("SESSION FOUND", {
        username: sess.username,
        role: sess.role,
        client_id: sess.client_id,
      });
    } else {
      console.log("NO SESSION: redirecting to login");
      const path = (window.location.pathname.split("/").pop() || "").toLowerCase();
      if (path !== "login.html") {
        window.location.href = "login.html";
      }
    }
  }

  function warnRlsStatus() {
    return;
  }

  function withClientIdAliases(rows) {
    return (rows || []).map((row) => {
      if (!row || typeof row !== "object") return row;
      const next = { ...row };
      if (next.client_id !== undefined && next.clientId === undefined) next.clientId = next.client_id;
      if (next.client_name !== undefined && next.clientName === undefined) next.clientName = next.client_name;
      if (next.user_name !== undefined && next.username === undefined) next.username = next.user_name;
      if (next.created_at !== undefined && next.createdAt === undefined) next.createdAt = next.created_at;
      if (next.updated_at !== undefined && next.updatedAt === undefined) next.updatedAt = next.updated_at;
      if (next.project_id !== undefined && next.projectId === undefined) next.projectId = next.project_id;
      if (next.project_date !== undefined && next.projectDate === undefined) next.projectDate = next.project_date;
      if (next.task_id !== undefined && next.taskId === undefined) next.taskId = next.task_id;
      if (next.task_order !== undefined && next.taskOrder === undefined) next.taskOrder = next.task_order;
      if (next.due_date !== undefined && next.dueDate === undefined) next.dueDate = next.due_date;
      if (next.drive_link !== undefined && next.driveLink === undefined) next.driveLink = next.drive_link;
      if (next.deliverable_id !== undefined && next.deliverableId === undefined) next.deliverableId = next.deliverable_id;
      if (next.deliverable_name !== undefined && next.name === undefined) next.name = next.deliverable_name;
      if (next.project_name !== undefined && next.projectName === undefined) next.projectName = next.project_name;
      if (next.cover_image_url !== undefined && next.coverImage === undefined) next.coverImage = next.cover_image_url;
      if (next.delivery_link !== undefined && next.deliveryLink === undefined) next.deliveryLink = next.delivery_link;
      if (next.comment_id !== undefined && next.commentId === undefined) next.commentId = next.comment_id;
      if (next.text !== undefined && next.body === undefined) next.body = next.text;
      return next;
    });
  }

  function getClientColumnMap(sample = {}) {
    return {
      clientId: "client_id",
      clientName: "client_name",
      createdAt: "created_at",
      updatedAt: "updated_at",
    };
  }

  function getProjectColumnMap(sample = {}) {
    return {
      projectId: "project_id",
      clientId: "client_id",
      name: "name",
      description: "description",
      status: "status",
      driveLink: "drive_link",
      projectDate: "project_date",
      createdAt: "created_at",
      updatedAt: "updated_at",
    };
  }

  function getTaskColumnMap(sample = {}) {
    return {
      taskId: "task_id",
      projectId: "project_id",
      title: "title",
      description: "description",
      assignee: "assignee",
      taskOrder: "task_order",
      status: "status",
      progress: "progress",
      dueDate: "due_date",
      createdAt: "created_at",
      updatedAt: "updated_at",
    };
  }

  function getDeliverableColumnMap(sample = {}) {
    return {
      deliverableId: "deliverable_id",
      clientId: "client_id",
      projectId: "project_id",
      projectName: "project_name",
      name: "deliverable_name",
      status: "status",
      coverImage: "cover_image_url",
      description: "description",
      deliveryLink: "delivery_link",
      visibleToClient: "visible_to_client",
      createdAt: "created_at",
      updatedAt: "updated_at",
    };
  }

  function getCommentColumnMap(sample = {}) {
    return {
      commentId: "comment_id",
      taskId: "task_id",
      projectId: "project_id",
      body: "text",
      createdAt: "created_at",
      updatedAt: "updated_at",
    };
  }

  function getAccountColumnMap(sample = {}) {
    return {
      username: "username",
      password: "password",
      role: "role",
      status: "status",
      clientId: "client_id",
      createdAt: "created_at",
      updatedAt: "updated_at",
      name: "name",
    };
  }

  async function apiGetAll(force = false, includeInactiveClients = false) {
    if (!force && cachedData) return cachedData;
    if (firstLoadPending) showPageLoader("Loading dashboard...");
    try {
      const supabase = getSupabaseClient();
      const sess = getLocalSession();
      if (!sess) {
        console.log("NO SESSION: redirecting to login");
        window.location.href = "login.html";
        throw new Error("Not authenticated");
      }

      warnRlsStatus();

      const isAdmin = sess.role === "admin";
      if (isAdmin) {
        console.log("ADMIN MODE");
      } else {
        console.log("CLIENT MODE", { client_id: sess.client_id });
      }

      const clientId = sess.client_id;
      let accountsRes;
      let clientsRes;
      let projectsRes;
      let tasksRes;
      let commentsRes;
      let deliverablesRes;

      if (isAdmin) {
        const requests = [
          supabase.from("accounts").select("*"),
          supabase.from("clients").select("*"),
          supabase.from("projects").select("*"),
          supabase.from("tasks").select("*"),
          supabase.from("comments").select("*"),
          supabase.from("deliverables").select("*"),
        ];
        const results = await Promise.all(requests);
        [accountsRes, clientsRes, projectsRes, tasksRes, commentsRes, deliverablesRes] = results;
        const firstError = results.find((res) => res.error)?.error;
        if (firstError) throw firstError;
      } else {
        accountsRes = await supabase.from("accounts").select("*").eq("username", sess.username);
        if (accountsRes.error) throw accountsRes.error;

        clientsRes = await supabase.from("clients").select("*").eq("client_id", clientId);
        if (clientsRes.error) throw clientsRes.error;

        projectsRes = await supabase.from("projects").select("*").eq("client_id", clientId);
        if (projectsRes.error) throw projectsRes.error;

        const projectIds = (projectsRes.data || []).map((row) => row.project_id || row.projectId).filter(Boolean);

        if (projectIds.length) {
          tasksRes = await supabase.from("tasks").select("*").in("project_id", projectIds);
          if (tasksRes.error) throw tasksRes.error;

          commentsRes = await supabase.from("comments").select("*").in("project_id", projectIds);
          if (commentsRes.error) throw commentsRes.error;

          deliverablesRes = await supabase.from("deliverables").select("*").in("project_id", projectIds);
          if (deliverablesRes.error) throw deliverablesRes.error;
        } else {
          tasksRes = { data: [] };
          commentsRes = { data: [] };
          deliverablesRes = { data: [] };
        }
      }

      const normalizedClients = validateClientsSchema(withClientIdAliases(clientsRes.data || []));
      const normalizedAccounts = withClientIdAliases(accountsRes.data || []);
      if (normalizedAccounts.length && normalizedClients.length) {
        const accountByClientId = new Map();
        normalizedAccounts.forEach((acct) => {
          if (acct.clientId) accountByClientId.set(acct.clientId, acct);
        });
        normalizedClients.forEach((client) => {
          if (!client.username && accountByClientId.has(client.clientId)) {
            client.username = accountByClientId.get(client.clientId).username || "";
          }
        });
      }
      cachedData = {
        ok: true,
        accounts: normalizedAccounts,
        clients: normalizedClients,
        projects: withClientIdAliases(projectsRes.data || []),
        tasks: withClientIdAliases(tasksRes.data || []),
        comments: withClientIdAliases(commentsRes.data || []),
        deliverables: withClientIdAliases(deliverablesRes.data || []),
      };

      return cachedData;
    } finally {
      if (firstLoadPending) {
        firstLoadPending = false;
        hidePageLoader();
      }
    }
  }

  async function apiPost(payload) {
    if (!payload || typeof payload !== "object") {
      return { ok: false, error: "Invalid payload" };
    }

    const supabase = getSupabaseClient();

    if (payload.action === "login") {
      cachedData = null;
      const username = String(payload.username || "").trim();
      const password = String(payload.password || "");
      console.log("LOGIN QUERY", { username });
      const response = await supabase
        .from("accounts")
        .select("*")
        .eq("username", username)
        .eq("password", password)
        .eq("status", "active")
        .maybeSingle();
      console.log("LOGIN RESPONSE", { data: response.data, error: response.error });

      if (response.error) {
        console.log("LOGIN ERROR", response.error);
        return { ok: false, error: response.error.message || "Login failed" };
      }
      if (!response.data) {
        console.log("LOGIN FAILED: no matching account");
        return { ok: false, error: "Invalid credentials" };
      }

      console.log("LOGIN SUCCESS", {
        username: response.data.username,
        role: response.data.role,
        client_id: response.data.client_id,
      });

      return {
        ok: true,
        user: {
          username: response.data.username,
          role: response.data.role,
          client_id: response.data.client_id,
        },
      };
    }

    const action = payload.action || "";
    const sess = getLocalSession();
    if (!sess) {
      return { ok: false, error: "Not authenticated" };
    }
    const adminOnlyActions = new Set([
      "addClient",
      "updateClient",
      "deleteClient",
      "addProject",
      "updateProject",
      "deleteProject",
      "addTask",
      "updateTask",
      "deleteTask",
      "addDeliverable",
      "updateDeliverable",
      "deleteDeliverable",
      "addUpdate",
      "updateUpdate",
      "deleteUpdate",
    ]);
    if (adminOnlyActions.has(action) && sess.role !== "admin") {
      return { ok: false, error: "Access denied" };
    }

    const pickFields = (source, fields) => {
      const out = {};
      fields.forEach((key) => {
        if (source[key] !== undefined) out[key] = source[key];
      });
      return out;
    };

    const pickDefined = (source) => {
      const out = {};
      Object.keys(source || {}).forEach((key) => {
        if (source[key] !== undefined) out[key] = source[key];
      });
      return out;
    };

    let response;
    if (action === "addClient") {
      const clientSample = (cachedData?.clients || []).find((row) => row) || {};
      const columnMap = getClientColumnMap(clientSample);
      const data = pickDefined({
        [columnMap.clientId]: payload.clientId,
        [columnMap.clientName]: payload.clientName,
        status: payload.status,
        [columnMap.createdAt]: payload.createdAt,
        [columnMap.updatedAt]: payload.updatedAt,
      });
      response = await supabase.from("clients").insert([data]);
      if (response?.error) {
        return { ok: false, error: response.error.message };
      }

      const accountSample = (cachedData?.accounts || []).find((row) => row) || {};
      const accountMap = getAccountColumnMap(accountSample);
      const accountData = pickDefined({
        [accountMap.username]: payload.username,
        [accountMap.password]: payload.password,
        [accountMap.role]: "client",
        [accountMap.name]: payload.clientName,
        [accountMap.status]: payload.status || "active",
        [accountMap.clientId]: payload.clientId,
        [accountMap.createdAt]: payload.createdAt,
        [accountMap.updatedAt]: payload.updatedAt,
      });
      const accountResp = await supabase.from("accounts").insert([accountData]);
      if (accountResp?.error) {
        return { ok: false, error: accountResp.error.message };
      }
    } else if (action === "updateClient") {
      const clientSample = (cachedData?.clients || []).find((row) => row) || {};
      const columnMap = getClientColumnMap(clientSample);
      const data = pickDefined({
        [columnMap.clientName]: payload.clientName,
        status: payload.status,
        [columnMap.updatedAt]: payload.updatedAt,
      });
      response = await supabase.from("clients").update(data).eq(columnMap.clientId, payload.clientId);
      if (response?.error) {
        return { ok: false, error: response.error.message };
      }

      const accountSample = (cachedData?.accounts || []).find((row) => row) || {};
      const accountMap = getAccountColumnMap(accountSample);
      const accountData = pickDefined({
        [accountMap.username]: payload.username,
        [accountMap.password]: payload.password,
        [accountMap.name]: payload.clientName,
        [accountMap.status]: payload.status,
        [accountMap.updatedAt]: payload.updatedAt,
      });
      const accountUpdate = await supabase
        .from("accounts")
        .update(accountData)
        .eq(accountMap.clientId, payload.clientId);
      if (accountUpdate?.error) {
        return { ok: false, error: accountUpdate.error.message };
      }
    } else if (action === "deleteClient") {
      const clientSample = (cachedData?.clients || []).find((row) => row) || {};
      const columnMap = getClientColumnMap(clientSample);
      response = await supabase.from("clients").delete().eq(columnMap.clientId, payload.clientId);
      if (response?.error) {
        return { ok: false, error: response.error.message };
      }

      const clientMatch =
        (cachedData?.clients || []).find((row) => row?.clientId === payload.clientId) || {};
      const accountClientId = clientMatch.clientId || payload.clientId;
      const accountUsername = clientMatch.username || payload.username;

      if (accountClientId) {
        const accountRes = await supabase
          .from("accounts")
          .update({ status: "archived", updated_at: new Date().toISOString() })
          .eq("client_id", accountClientId);
        if (accountRes?.error) {
          return { ok: false, error: accountRes.error.message };
        }
      }

      if (accountUsername) {
        const accountRes = await supabase
          .from("accounts")
          .update({ status: "archived", updated_at: new Date().toISOString() })
          .eq("username", accountUsername);
        if (accountRes?.error) {
          return { ok: false, error: accountRes.error.message };
        }
      }
    } else if (action === "addProject") {
      const projectSample = (cachedData?.projects || []).find((row) => row) || {};
      const columnMap = getProjectColumnMap(projectSample);
      const data = pickDefined({
        [columnMap.projectId]: payload.projectId,
        [columnMap.clientId]: payload.clientId,
        [columnMap.name]: payload.name,
        [columnMap.description]: payload.description,
        [columnMap.status]: payload.status,
        [columnMap.driveLink]: payload.driveLink,
        [columnMap.projectDate]: payload.projectDate,
        [columnMap.createdAt]: payload.createdAt,
        [columnMap.updatedAt]: payload.updatedAt,
      });
      response = await supabase.from("projects").insert([data]);
    } else if (action === "updateProject") {
      const projectSample = (cachedData?.projects || []).find((row) => row) || {};
      const columnMap = getProjectColumnMap(projectSample);
      const data = pickDefined({
        [columnMap.clientId]: payload.clientId,
        [columnMap.name]: payload.name,
        [columnMap.description]: payload.description,
        [columnMap.status]: payload.status,
        [columnMap.driveLink]: payload.driveLink,
        [columnMap.projectDate]: payload.projectDate,
        [columnMap.updatedAt]: payload.updatedAt,
      });
      response = await supabase.from("projects").update(data).eq(columnMap.projectId, payload.projectId);
    } else if (action === "deleteProject") {
      const projectSample = (cachedData?.projects || []).find((row) => row) || {};
      const taskSample = (cachedData?.tasks || []).find((row) => row) || {};
      const deliverableSample = (cachedData?.deliverables || []).find((row) => row) || {};
      const commentSample = (cachedData?.comments || []).find((row) => row) || {};
      const projectMap = getProjectColumnMap(projectSample);
      const taskMap = getTaskColumnMap(taskSample);
      const deliverableMap = getDeliverableColumnMap(deliverableSample);
      const commentMap = getCommentColumnMap(commentSample);
      const projectId = payload.projectId;

      const taskDelete = await supabase.from("tasks").delete().eq(taskMap.projectId, projectId);
      if (taskDelete.error) return { ok: false, error: taskDelete.error.message };

      const deliverableDelete = await supabase
        .from("deliverables")
        .delete()
        .eq(deliverableMap.projectId, projectId);
      if (deliverableDelete.error) return { ok: false, error: deliverableDelete.error.message };

      const commentDelete = await supabase
        .from("comments")
        .delete()
        .eq(commentMap.projectId, projectId);
      if (commentDelete.error) return { ok: false, error: commentDelete.error.message };

      response = await supabase.from("projects").delete().eq(projectMap.projectId, projectId);
    } else if (action === "addTask") {
      const taskSample = (cachedData?.tasks || []).find((row) => row) || {};
      const columnMap = getTaskColumnMap(taskSample);
      const data = pickDefined({
        [columnMap.taskId]: payload.taskId,
        [columnMap.projectId]: payload.projectId,
        [columnMap.title]: payload.title,
        [columnMap.description]: payload.description,
        [columnMap.assignee]: payload.assignee,
        [columnMap.taskOrder]: payload.taskOrder,
        [columnMap.status]: payload.status,
        [columnMap.progress]: payload.progress,
        [columnMap.dueDate]: payload.dueDate,
        [columnMap.createdAt]: payload.createdAt,
        [columnMap.updatedAt]: payload.updatedAt,
      });
      response = await supabase.from("tasks").insert([data]);
    } else if (action === "updateTask") {
      const taskSample = (cachedData?.tasks || []).find((row) => row) || {};
      const columnMap = getTaskColumnMap(taskSample);
      const data = pickDefined({
        [columnMap.projectId]: payload.projectId,
        [columnMap.title]: payload.title,
        [columnMap.description]: payload.description,
        [columnMap.assignee]: payload.assignee,
        [columnMap.taskOrder]: payload.taskOrder,
        [columnMap.status]: payload.status,
        [columnMap.progress]: payload.progress,
        [columnMap.dueDate]: payload.dueDate,
        [columnMap.updatedAt]: payload.updatedAt,
      });
      response = await supabase.from("tasks").update(data).eq(columnMap.taskId, payload.taskId);
    } else if (action === "deleteTask") {
      const taskSample = (cachedData?.tasks || []).find((row) => row) || {};
      const columnMap = getTaskColumnMap(taskSample);
      response = await supabase.from("tasks").delete().eq(columnMap.taskId, payload.taskId);
    } else if (action === "addDeliverable") {
      const deliverableSample = (cachedData?.deliverables || []).find((row) => row) || {};
      const columnMap = getDeliverableColumnMap(deliverableSample);
      const data = pickDefined({
        [columnMap.deliverableId]: payload.deliverableId,
        [columnMap.clientId]: payload.clientId,
        [columnMap.projectId]: payload.projectId,
        [columnMap.projectName]: payload.projectName,
        [columnMap.name]: payload.name,
        [columnMap.status]: payload.status,
        [columnMap.coverImage]: payload.coverImage,
        [columnMap.description]: payload.description,
        [columnMap.deliveryLink]: payload.deliveryLink,
        [columnMap.visibleToClient]: payload.visibleToClient,
        [columnMap.createdAt]: payload.createdAt,
        [columnMap.updatedAt]: payload.updatedAt,
      });
      response = await supabase.from("deliverables").insert([data]);
    } else if (action === "updateDeliverable") {
      const deliverableSample = (cachedData?.deliverables || []).find((row) => row) || {};
      const columnMap = getDeliverableColumnMap(deliverableSample);
      const data = pickDefined({
        [columnMap.clientId]: payload.clientId,
        [columnMap.projectId]: payload.projectId,
        [columnMap.projectName]: payload.projectName,
        [columnMap.name]: payload.name,
        [columnMap.status]: payload.status,
        [columnMap.coverImage]: payload.coverImage,
        [columnMap.description]: payload.description,
        [columnMap.deliveryLink]: payload.deliveryLink,
        [columnMap.visibleToClient]: payload.visibleToClient,
        [columnMap.updatedAt]: payload.updatedAt,
      });
      response = await supabase.from("deliverables").update(data).eq(columnMap.deliverableId, payload.deliverableId);
    } else if (action === "deleteDeliverable") {
      const deliverableSample = (cachedData?.deliverables || []).find((row) => row) || {};
      const columnMap = getDeliverableColumnMap(deliverableSample);
      response = await supabase.from("deliverables").delete().eq(columnMap.deliverableId, payload.deliverableId);
    } else if (action === "addUpdate") {
      const commentSample = (cachedData?.comments || []).find((row) => row) || {};
      const columnMap = getCommentColumnMap(commentSample);
      const data = pickDefined({
        [columnMap.commentId]: payload.commentId,
        [columnMap.taskId]: payload.taskId,
        [columnMap.projectId]: payload.projectId,
        [columnMap.body]: payload.body,
        [columnMap.createdAt]: payload.createdAt,
        [columnMap.updatedAt]: payload.updatedAt,
      });
      response = await supabase.from("comments").insert([data]);
    } else if (action === "updateUpdate") {
      const commentSample = (cachedData?.comments || []).find((row) => row) || {};
      const columnMap = getCommentColumnMap(commentSample);
      const data = pickDefined({
        [columnMap.body]: payload.body,
        [columnMap.updatedAt]: payload.updatedAt,
      });
      response = await supabase.from("comments").update(data).eq(columnMap.commentId, payload.commentId);
    } else if (action === "deleteUpdate") {
      const commentSample = (cachedData?.comments || []).find((row) => row) || {};
      const columnMap = getCommentColumnMap(commentSample);
      response = await supabase.from("comments").delete().eq(columnMap.commentId, payload.commentId);
    } else {
      return { ok: false, error: "Unknown action" };
    }

    if (response?.error) {
      return { ok: false, error: response.error.message };
    }

    cachedData = null;
    return { ok: true, data: response?.data || null };
  }

  async function fetchAccountForUser(user) {
    if (!user) return null;
    const supabase = getSupabaseClient();
    const candidates = [
      { column: "user_id", value: user.id },
      { column: "id", value: user.id },
      { column: "email", value: user.email },
    ];

    for (const candidate of candidates) {
      if (!candidate.value) continue;
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq(candidate.column, candidate.value)
        .maybeSingle();
      if (error) {
        continue;
      }
      if (data) return data;
    }
    return null;
  }

  async function sha256(text) {
    if (!window.crypto?.subtle) return text;
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function computeSummary(tasks) {
    const summary = {
      total: tasks.length,
      completed: 0,
      inProgress: 0,
      notStarted: 0,
      blocked: 0,
    };
    (tasks || []).forEach((t) => {
      const s = t.status || "not-started";
      if (s === "completed") summary.completed++;
      else if (s === "in-progress") summary.inProgress++;
      else if (s === "blocked") summary.blocked++;
      else summary.notStarted++;
    });
    return summary;
  }

  function computeProjectProgress(tasks) {
    if (!tasks || !tasks.length) return 0;
    const values = tasks.map((t) => Math.max(0, Math.min(100, Number(t.progress || 0))));
    const sum = values.reduce((a, b) => a + b, 0);
    return Math.round(sum / values.length);
  }

  function computeProjectSummary(projects) {
    const summary = {
      total: projects.length,
      completed: 0,
      inProgress: 0,
      notStarted: 0,
      blocked: 0,
    };
    (projects || []).forEach((p) => {
      const s = p.status || "not-started";
      if (s === "completed") summary.completed++;
      else if (s === "in-progress") summary.inProgress++;
      else if (s === "blocked") summary.blocked++;
      else summary.notStarted++;
    });
    return summary;
  }

  function formatDate(val) {
    if (!val) return "";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatDateTime(val) {
    if (!val) return "";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function getLocalSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  const ALLOWED_CLIENT_STATUSES = ["active", "inactive", "archived", "blocked"];

  function validateClientsSchema(clients = []) {
    return (clients || []).map((c) => {
      const next = { ...c };
      const required = ["clientId", "clientName", "status", "createdAt", "updatedAt"];
      required.forEach((key) => {
        if (next[key] === undefined || next[key] === null) {
          next[key] = key === "status" ? "active" : "";
        }
      });
      if (!ALLOWED_CLIENT_STATUSES.includes(next.status)) {
        next.status = "active";
      }
      return next;
    });
  }

  function requireAuth(options = {}, redirectIfMissing = true) {
    const sess = getLocalSession();
    if (!sess && redirectIfMissing) {
      showPageLoader("Redirecting to sign in...");
      window.location.href = "login.html";
      return null;
    }
    if (!sess) return null;

    if (options.role && sess.role !== options.role) {
      // If wrong role, send to overview
      showPageLoader("Redirecting...");
      window.location.href = sess.role === "client" ? "client-dashboard-overview.html" : "dashboard-overview.html";
      return null;
    }
    return sess;
  }

  function disableButton(btn, reason) {
    if (!btn) return;
    btn.disabled = true;
    btn.classList.add("is-disabled");
    btn.setAttribute("aria-disabled", "true");
    if (reason && !btn.title) btn.title = reason;
  }

  function updateSidebarStats(data) {
    if (!data) return;
    const projects = data.projects || [];
    const tasks = data.tasks || [];

    const summary = computeProjectSummary(projects);

    const setText = (id, v) => {
      const el = document.getElementById(id);
      if (!el) return;
      const val = Number(v);
      el.textContent = Number.isFinite(val) && val === 0 ? "--" : v;
    };

    setText("statTotalProjects", projects.length);
    setText("statTotalTasks", tasks.length);
    setText("statInProgress", summary.inProgress);
    setText("statCompleted", summary.completed);
    setText("statNotStarted", summary.notStarted);
  }

  function renderClientHeader(clients = []) {
    const sess = getLocalSession();
    if (!sess) return;
    const nameEl = document.getElementById("headerClientName");
    const statusEl = document.getElementById("headerClientStatus");
    if (!nameEl && !statusEl) return;

    let name = sess.username || "Client";
    let status = "Active";

    if (clients && clients.length) {
      const match =
        clients.find((c) => c.clientId === sess.clientId) ||
        clients.find((c) => c.username === sess.username);
      if (match) {
        name = match.clientName || match.username || name;
        status = match.status || status;
      }
    }

    if (nameEl) nameEl.textContent = name;
    if (statusEl) statusEl.textContent = status;
  }

  function initSidebarChrome() {
    const sess = getLocalSession();

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        showPageLoader("Signing out...");
        clearSession();
        window.location.href = "login.html";
      });
    }

    // Hide admin-only links for clients
    if (sess && sess.role !== "admin") {
      const adminLinks = ["navClientsLink"];
      adminLinks.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
      });
    }

    // Active link
    const path = (window.location.pathname.split("/").pop() || "").toLowerCase();
    if (path.startsWith("client-") && sess && sess.role !== "client") {
      showPageLoader("Redirecting...");
      window.location.href = "dashboard-overview.html";
      return;
    }
    const map = {
      "dashboard-overview.html": "navOverview",
      "dashboard-clients.html": "navClientsLink",
      "dashboard-projects.html": "navProjectsLink",
      "dashboard-tasks.html": "navTasksLink",
      "dashboard-deliverables.html": "navDeliverablesLink",
      "client-dashboard-overview.html": "navOverview",
      "client-dashboard-projects.html": "navProjectsLink",
      "client-dashboard-tasks.html": "navTasksLink",
      "client-dashboard-deliverables.html": "navDeliverablesLink",
    };
    const activeId = map[path];
    if (activeId) {
      const el = document.getElementById(activeId);
      if (el) el.classList.add("active");
    }

    const nav = document.querySelector(".nav");
    if (nav) {
      nav.addEventListener("click", (e) => {
        const link = e.target.closest("a");
        if (!link) return;
        if (link.target === "_blank") return;
        showPageLoader("Loading...");
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensurePageLoader();
    logSessionStatus();
    initSidebarChrome();
  });

  window.BXCore = {
    apiGetAll,
    apiPost,
    fetchAccountForUser,
    getSupabaseClient,
    logSessionStatus,
    sha256,
    computeSummary,
    computeProjectProgress,
    computeProjectSummary,
    formatDate,
    formatDateTime,
    saveSession,
    getLocalSession,
    clearSession,
    requireAuth,
    updateSidebarStats,
    renderClientHeader,
    showPageLoader,
    hidePageLoader,
    setButtonLoading,
    renderSkeleton,
    validateClientsSchema,
    ALLOWED_CLIENT_STATUSES,
    disableButton,
    showToast,
    confirmAction,
  };
})();

