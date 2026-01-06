/**
 * Utility to return JSON
 */
function returnJson(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ================= ENTRY ================= */

function doGet(e) {
  try {
    return returnJson({ ok: false, error: "GET not supported. Use POST." });
  } catch (err) {
    return returnJson({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

function doPost(e) {
  try {
    var data = null;
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        return returnJson({ ok: false, error: "Invalid JSON body" });
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    } else {
      return returnJson({ ok: false, error: "Missing request data" });
    }

    if (!data || !data.action) {
      return returnJson({ ok: false, error: "Missing action" });
    }

    return returnJson(handlePost(data));
  } catch (err) {
    return returnJson({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

/* ================= ROUTING ================= */

function handlePost(data) {
  if (!data || !data.action) {
    return { ok: false, error: "Missing action" };
  }

  try {
    switch (data.action) {
      // AUTH
      case "login": return handleLogin(data);

      // CLIENTS (ADMIN ONLY)
      case "addClient": return handleAddClient(data);
      case "deleteClient": return handleDeleteClient(data);

      // PROJECTS
      case "addProject": return handleAddProject(data);
      case "deleteProject": return handleDeleteProject(data);

      // TASKS
      case "addTask": return handleAddTask(data);
      case "updateTask": return handleUpdateTask(data);
      case "deleteTask": return handleDeleteTask(data);

      // DELIVERABLES
      case "addDeliverable": return handleAddDeliverable(data);
      case "updateDeliverable": return handleUpdateDeliverable(data);
      case "deleteDeliverable": return handleDeleteDeliverable(data);
      case "archiveDeliverable": return handleArchiveDeliverable(data);

      default:
        return { ok: false, error: "Unknown POST action" };
    }
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

/* ================= HELPERS ================= */

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

var SPREADSHEET_ID = "15OFIEwbb5rAB1dOSCLQ0JfVKkNwKf9olwut7zdNdI2M";
function getSheet(name) {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (!sheet) throw new Error("Missing sheet: " + name);
  return sheet;
}

function readTable(name) {
  var values = getSheet(name).getDataRange().getValues();
  if (values.length < 2) return [];

  var headers = values[0].map(function(h) {
    return String(h || "").trim();
  });

  return values.slice(1).map(function(row) {
    var obj = {};
    for (var i = 0; i < headers.length; i++) {
      var key = headers[i];
      if (!key) continue;
      obj[key] = row[i] !== undefined ? row[i] : "";
    }
    return obj;
  });
}

function getHeaderIndex(headers, headerName, sheetName) {
  var idx = headers.indexOf(headerName);
  if (idx === -1) throw new Error("Missing header '" + headerName + "' in sheet: " + sheetName);
  return idx;
}

function getUserFromRequest(data) {
  if (!data || !data.username || !data.password) {
    throw new Error("Missing credentials");
  }

  var inputUsername = normalize(data.username);
  var inputPassword = String(data.password || "").trim();

  var user = readTable("Accounts").find(function(a) {
    var accountUsername = normalize(a.username);
    var accountPassword = String(a.password || "").trim();
    var accountStatus = normalize(a.status);
    return accountUsername === inputUsername &&
      accountPassword === inputPassword &&
      accountStatus === "active";
  });

  if (!user) throw new Error("Invalid credentials");
  return user;
}

function requireRole(user, roles) {
  var role = normalize(user && user.role);
  var allowed = roles.map(function(r) { return normalize(r); });
  if (!role || allowed.indexOf(role) === -1) {
    throw new Error("Access denied");
  }
}

/* ================= GET ALL ================= */

function handleGetAll(data) {
  var user = getUserFromRequest(data);

  if (normalize(user.role) === "admin") {
    return {
      ok: true,
      clients: readTable("Clients").filter(function(c) {
        return normalize(c.status) === "active";
      }),
      projects: readTable("Projects"),
      tasks: readTable("Tasks"),
      deliverables: readTable("Deliverables")
    };
  }

  if (!user.clientId) {
    throw new Error("Client account misconfigured");
  }

  var clientId = user.clientId;
  var projects = readTable("Projects").filter(function(p) {
    return p.clientId === clientId;
  });
  var projectIds = {};
  projects.forEach(function(p) {
    projectIds[p.projectId] = true;
  });

  return {
    ok: true,
    projects: projects,
    tasks: readTable("Tasks").filter(function(t) {
      return !!projectIds[t.projectId];
    }),
    deliverables: readTable("Deliverables").filter(function(d) {
      return d.clientId === clientId;
    })
  };
}

/* ================= LOGIN ================= */

function handleLogin(data) {
  var user = getUserFromRequest(data);

  return {
    ok: true,
    role: user.role,
    user: {
      username: user.username,
      name: user.name,
      clientId: user.clientId || null
    }
  };
}

/* ================= CLIENTS ================= */

function handleAddClient(d) {
  var user = getUserFromRequest(d);
  requireRole(user, ["admin"]);

  getSheet("Clients").appendRow([
    d.clientId,
    d.clientName,
    "active",
    new Date().toISOString(),
    new Date().toISOString()
  ]);

  return { ok: true };
}

function handleDeleteClient(d) {
  var user = getUserFromRequest(d);
  requireRole(user, ["admin"]);

  var sheet = getSheet("Clients");
  var values = sheet.getDataRange().getValues();
  var headers = values[0];

  var idIndex = getHeaderIndex(headers, "clientId", "Clients");
  var statusIndex = getHeaderIndex(headers, "status", "Clients");
  var updatedAtIndex = getHeaderIndex(headers, "updatedAt", "Clients");

  for (var i = 1; i < values.length; i++) {
    if (values[i][idIndex] === d.clientId) {
      sheet.getRange(i + 1, statusIndex + 1).setValue("archived");
      sheet.getRange(i + 1, updatedAtIndex + 1)
        .setValue(new Date().toISOString());
      break;
    }
  }
  return { ok: true };
}

/* ================= PROJECTS ================= */

function handleAddProject(d) {
  var user = getUserFromRequest(d);
  requireRole(user, ["admin"]);

  getSheet("Projects").appendRow([
    d.projectId,
    d.clientId,
    d.name || "",
    d.description || "",
    d.status || "in-progress",
    d.driveLink || "",
    d.projectDate || ""
  ]);
  return { ok: true };
}

function handleDeleteProject(d) {
  var user = getUserFromRequest(d);
  requireRole(user, ["admin"]);

  var projectId = d.projectId;
  if (!projectId) throw new Error("Missing projectId");

  var projectSheet = getSheet("Projects");
  var projectValues = projectSheet.getDataRange().getValues();
  var projectHeaders = projectValues[0];
  var projectIdIndex = getHeaderIndex(projectHeaders, "projectId", "Projects");

  for (var i = projectValues.length - 1; i >= 1; i--) {
    if (projectValues[i][projectIdIndex] === projectId) {
      projectSheet.deleteRow(i + 1);
    }
  }

  var taskSheet = getSheet("Tasks");
  var taskValues = taskSheet.getDataRange().getValues();
  var taskProjectIndex = getHeaderIndex(taskValues[0], "projectId", "Tasks");
  for (var j = taskValues.length - 1; j >= 1; j--) {
    if (taskValues[j][taskProjectIndex] === projectId) {
      taskSheet.deleteRow(j + 1);
    }
  }

  var deliverableSheet = getSheet("Deliverables");
  var deliverableValues = deliverableSheet.getDataRange().getValues();
  var deliverableProjectIndex = getHeaderIndex(deliverableValues[0], "projectId", "Deliverables");
  for (var k = deliverableValues.length - 1; k >= 1; k--) {
    if (deliverableValues[k][deliverableProjectIndex] === projectId) {
      deliverableSheet.deleteRow(k + 1);
    }
  }
  return { ok: true };
}

/* ================= TASKS ================= */

function handleAddTask(d) {
  var user = getUserFromRequest(d);
  requireRole(user, ["admin"]);

  getSheet("Tasks").appendRow([
    d.taskId,
    d.projectId,
    d.title || "",
    d.description || "",
    d.assignee || "",
    d.taskOrder || "",
    d.status || "in-progress",
    Number(d.progress || 0),
    d.dueDate || "",
    new Date().toISOString()
  ]);
  return { ok: true };
}

function handleUpdateTask(d) {
  var user = getUserFromRequest(d);

  if (normalize(user.role) === "client") {
    var allowed = ["status", "progress"];
    var keys = Object.keys(d).filter(function(k) {
      return ["action", "taskId", "username", "password"].indexOf(k) === -1;
    });
    if (keys.some(function(k) { return allowed.indexOf(k) === -1; })) {
      throw new Error("Clients can only update task status or progress");
    }
  }

  var sheet = getSheet("Tasks");
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idIndex = getHeaderIndex(headers, "taskId", "Tasks");

  for (var i = 1; i < values.length; i++) {
    if (values[i][idIndex] === d.taskId) {
      headers.forEach(function(h, j) {
        if (d[h] !== undefined) {
          sheet.getRange(i + 1, j + 1).setValue(d[h]);
        }
      });
      break;
    }
  }
  return { ok: true };
}

function handleDeleteTask(d) {
  var user = getUserFromRequest(d);
  requireRole(user, ["admin"]);

  var sheet = getSheet("Tasks");
  var values = sheet.getDataRange().getValues();
  var idIndex = getHeaderIndex(values[0], "taskId", "Tasks");

  for (var i = values.length - 1; i >= 1; i--) {
    if (values[i][idIndex] === d.taskId) {
      sheet.deleteRow(i + 1);
    }
  }
  return { ok: true };
}

/* ================= DELIVERABLES ================= */

function handleAddDeliverable(d) {
  var user = getUserFromRequest(d);
  requireRole(user, ["admin"]);

  getSheet("Deliverables").appendRow([
    d.deliverableId,
    d.clientId,
    d.clientName,
    d.projectId,
    d.projectName,
    d.deliverableName,
    d.status || "in-progress",
    d.coverImageUrl || "",
    d.description || "",
    d.deliveryLink || "",
    false,
    new Date().toISOString(),
    new Date().toISOString()
  ]);
  return { ok: true };
}

function handleUpdateDeliverable(d) {
  var user = getUserFromRequest(d);
  requireRole(user, ["admin"]);

  var sheet = getSheet("Deliverables");
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idIndex = getHeaderIndex(headers, "deliverableId", "Deliverables");

  for (var i = 1; i < values.length; i++) {
    if (values[i][idIndex] === d.deliverableId) {
      headers.forEach(function(h, j) {
        if (d[h] !== undefined) {
          sheet.getRange(i + 1, j + 1).setValue(d[h]);
        }
      });
      break;
    }
  }
  return { ok: true };
}

function handleDeleteDeliverable(d) {
  var user = getUserFromRequest(d);
  requireRole(user, ["admin"]);

  var sheet = getSheet("Deliverables");
  var values = sheet.getDataRange().getValues();
  var idIndex = getHeaderIndex(values[0], "deliverableId", "Deliverables");

  for (var i = values.length - 1; i >= 1; i--) {
    if (values[i][idIndex] === d.deliverableId) {
      sheet.deleteRow(i + 1);
    }
  }
  return { ok: true };
}

function handleArchiveDeliverable(d) {
  var user = getUserFromRequest(d);
  requireRole(user, ["admin"]);

  var sheet = getSheet("Deliverables");
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idIndex = getHeaderIndex(headers, "deliverableId", "Deliverables");

  for (var i = 1; i < values.length; i++) {
    if (values[i][idIndex] === d.deliverableId) {
      sheet.getRange(i + 1, getHeaderIndex(headers, "status", "Deliverables") + 1)
        .setValue("archived");
      break;
    }
  }
  return { ok: true };
}
