const API_BASE_URL = "http://127.0.0.1:8000/api";
const STUDENTS_URL = `${API_BASE_URL}/students`;
const ITEMS_URL = `${API_BASE_URL}/items`;
const accessToken = localStorage.getItem("access_token");

const form = document.getElementById("studentForm");
const list = document.getElementById("studentList");
const message = document.getElementById("message");
const apiStatus = document.getElementById("apiStatus");
const searchInput = document.getElementById("searchInput");
const studentCount = document.getElementById("studentCount");
const refreshButton = document.getElementById("refreshButton");
const itemForm = document.getElementById("itemForm");
const itemList = document.getElementById("itemList");
const itemMessage = document.getElementById("itemMessage");
const itemCount = document.getElementById("itemCount");
const itemStudentFilter = document.getElementById("itemStudentFilter");
const itemCategoryFilter = document.getElementById("itemCategoryFilter");

const fields = [
  "name",
  "email",
  "department",
  "college",
  "bio",
  "skills"
];

let allStudents = [];
let allItems = [];
let isLoading = false;
let isLoadingItems = false;

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function populateStudentSelects() {
  if (!itemStudentFilter) return;
  const filterValue = itemStudentFilter.value;
  const formSelect = document.getElementById("itemStudentId");
  const formValue = formSelect ? formSelect.value : "";
  const filterOptions = ['<option value="">All students</option>'];
  const studentOptions = ['<option value="">Select a student</option>'];

  for (const student of allStudents) {
    const option = `<option value="${escapeHTML(student.id)}">${escapeHTML(student.name)} (#${escapeHTML(student.id)})</option>`;
    filterOptions.push(option);
    studentOptions.push(option);
  }

  itemStudentFilter.innerHTML = filterOptions.join("");
  if (formSelect) {
    formSelect.innerHTML = studentOptions.join("");
  }
  itemStudentFilter.value = filterValue;

  if (formSelect && allStudents.some(student => String(student.id) === formValue)) {
    formSelect.value = formValue;
  }
}

async function apiRequest(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("student");
    window.location.replace("login.html");
    throw new Error("Your session has expired. Please sign in again.");
  }

  if (!response.ok) {
    let details;
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await response.json();
      details = typeof body.detail === "string"
        ? body.detail
        : JSON.stringify(body.detail ?? body);
    } else {
      details = await response.text();
    }

    throw new Error(
      details || `Request failed (${response.status}).`
    );
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return null;
}

function showMessage(text, type = "") {
  if (message) {
    message.textContent = text;
    message.className = `message ${type}`.trim();
  }
}

function showItemMessage(text, type = "") {
  if (itemMessage) {
    itemMessage.textContent = text;
    itemMessage.className = `message ${type}`.trim();
  }
}

function setAPIStatus(status) {
  if (!apiStatus) return;
  apiStatus.classList.remove("connected", "disconnected");

  if (status === "connected") {
    apiStatus.classList.add("connected");
    apiStatus.replaceChildren();

    const indicator = document.createElement("span");
    indicator.className = "dot";
    indicator.setAttribute("aria-hidden", "true");

    apiStatus.append(indicator, document.createTextNode("API Connected"));
  } else if (status === "disconnected") {
    apiStatus.classList.add("disconnected");
    apiStatus.replaceChildren();

    const indicator = document.createElement("span");
    indicator.className = "dot";
    indicator.setAttribute("aria-hidden", "true");

    apiStatus.append(indicator, document.createTextNode("API Disconnected"));
  } else {
    apiStatus.textContent = "Connecting...";
  }
}

function getStudentData() {
  const data = {};
  for (const field of fields) {
    const el = document.getElementById(field);
    data[field] = el ? el.value.trim() : "";
  }
  return data;
}

function getInitials(name) {
  const words = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "ST";
  return words.slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join("");
}

function updateStatistics(students) {
  const totalStudentsEl = document.getElementById("totalStudents");
  const totalDeptsEl = document.getElementById("totalDepartments");
  const skillsEl = document.getElementById("profilesWithSkills");

  if (totalStudentsEl) totalStudentsEl.textContent = students.length;

  if (totalDeptsEl) {
    const departments = new Set(
      students
        .map(student => String(student.department ?? "").trim().toLowerCase())
        .filter(Boolean)
    );
    totalDeptsEl.textContent = departments.size;
  }

  if (skillsEl) {
    const withSkills = students.filter(student =>
      String(student.skills ?? "").trim().length > 0
    ).length;
    skillsEl.textContent = withSkills;
  }
}

function createStudentCard(student) {
  const card = document.createElement("article");
  card.className = "student-card";

  const skills = String(student.skills ?? "")
    .split(",")
    .map(skill => skill.trim())
    .filter(Boolean);

  const skillMarkup = skills.length
    ? skills.map(skill => `<span class="skill-tag">${escapeHTML(skill)}</span>`).join("")
    : '<span class="no-skills">No skills added yet</span>';

  card.innerHTML = `
    <div class="student-card-top">
      <div class="student-avatar" aria-hidden="true">
        ${escapeHTML(getInitials(student.name))}
      </div>

      <div class="student-heading">
        <h3>${escapeHTML(student.name || "Unnamed Student")}</h3>
        <p class="email">${escapeHTML(student.email || "No email")}</p>
      </div>

      <span class="student-id">#${escapeHTML(student.id ?? "—")}</span>
    </div>

    <div class="student-divider"></div>

    <p class="student-detail">
      <span class="detail-label">Department</span>
      <strong>${escapeHTML(student.department || "Not provided")}</strong>
    </p>

    <p class="student-detail">
      <span class="detail-label">College</span>
      <strong>${escapeHTML(student.college || "Not provided")}</strong>
    </p>

    <p class="student-bio">${escapeHTML(student.bio || "No introduction provided yet.")}</p>

    <div class="skill-list">${skillMarkup}</div>

    <div class="card-actions">
      <button type="button" class="button button-light" data-action="edit">
        ✎ Edit
      </button>
      <button type="button" class="button button-danger" data-action="delete">
        Delete
      </button>
    </div>
  `;

  card.querySelector('[data-action="edit"]').addEventListener("click", () => {
    document.getElementById("studentId").value = student.id ?? "";

    for (const field of fields) {
      const el = document.getElementById(field);
      if (el) el.value = student[field] ?? "";
    }

    document.getElementById("formTitle").textContent = "Edit Student";
    document.getElementById("saveButton").textContent = "Update Student";
    document.getElementById("cancelButton").hidden = false;

    showMessage(`Editing ${student.name || "student"}'s profile.`);
    document.getElementById("studentFormSection")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    document.getElementById("name")?.focus({ preventScroll: true });
  });

  card.querySelector('[data-action="delete"]').addEventListener("click", async () => {
    if (student.id == null) {
      showMessage("This student has no ID. Cannot delete the profile.", "error");
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to delete ${student.name || "this student"}'s profile?`
    );

    if (!confirmed) return;

    try {
      await apiRequest(`${STUDENTS_URL}/${encodeURIComponent(student.id)}`, {
        method: "DELETE"
      });

      if (String(document.getElementById("studentId").value) === String(student.id)) {
        resetForm();
      }

      showMessage("Student deleted successfully.", "success");
      await loadStudents();
      await loadItems();
    } catch (error) {
      showMessage(error.message || "Could not delete student.", "error");
    }
  });

  return card;
}

function renderStudents(students) {
  if (!list) return;
  list.replaceChildren();

  if (!students.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    empty.textContent = searchInput && searchInput.value.trim()
      ? "No students match your search. Try a different keyword."
      : "No student profiles yet. Add your first student using the form below.";

    list.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const student of students) {
    fragment.appendChild(createStudentCard(student));
  }

  list.appendChild(fragment);
}

function filterStudents() {
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

  const filteredStudents = allStudents.filter(student =>
    fields.some(field =>
      String(student[field] ?? "").toLowerCase().includes(query)
    )
  );

  if (studentCount) {
    studentCount.textContent = query
      ? `Showing ${filteredStudents.length} of ${allStudents.length} students`
      : `${allStudents.length} student${allStudents.length === 1 ? "" : "s"}`;
  }

  renderStudents(filteredStudents);
}

async function loadStudents() {
  if (isLoading) return;

  isLoading = true;
  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.textContent = "Loading...";
  }
  setAPIStatus("loading");

  if (list) {
    list.replaceChildren();
    const loading = document.createElement("div");
    loading.className = "empty-state";
    loading.textContent = "Loading student profiles...";
    list.appendChild(loading);
  }

  try {
    const students = await apiRequest(STUDENTS_URL);

    if (!Array.isArray(students)) {
      throw new Error("Unexpected API response. Expected a student list.");
    }

    allStudents = students;

    setAPIStatus("connected");
    updateStatistics(allStudents);
    populateStudentSelects();
    filterStudents();
  } catch (error) {
    allStudents = [];

    setAPIStatus("disconnected");
    updateStatistics([]);

    if (studentCount) studentCount.textContent = "Unable to load profiles";

    if (list) {
      list.replaceChildren();
      const errorState = document.createElement("div");
      errorState.className = "empty-state";
      errorState.textContent =
        "Could not load students. Check that FastAPI is running and CORS is configured.";
      list.appendChild(errorState);
    }

    showMessage(error.message || "Could not connect to the backend.", "error");
  } finally {
    isLoading = false;
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.textContent = "↻ Refresh";
    }
  }
}

if (form) {
  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const id = document.getElementById("studentId").value;
    const url = id
      ? `${STUDENTS_URL}/${encodeURIComponent(id)}`
      : STUDENTS_URL;

    const method = id ? "PUT" : "POST";
    const saveButton = document.getElementById("saveButton");

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = id ? "Updating..." : "Saving...";
    }

    try {
      await apiRequest(url, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(getStudentData())
      });

      showMessage(
        id ? "Student updated successfully." : "Student added successfully.",
        "success"
      );

      resetForm();
      await loadStudents();

      document.getElementById("students")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } catch (error) {
      showMessage(error.message || "Could not save student.", "error");
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = document.getElementById("studentId").value
          ? "Update Student"
          : "Save Student";
      }
    }
  });
}

function resetForm() {
  if (form) form.reset();

  const idEl = document.getElementById("studentId");
  if (idEl) idEl.value = "";
  
  const formTitle = document.getElementById("formTitle");
  if (formTitle) formTitle.textContent = "Add New Student";

  const saveBtn = document.getElementById("saveButton");
  if (saveBtn) saveBtn.textContent = "Save Student";

  const cancelBtn = document.getElementById("cancelButton");
  if (cancelBtn) cancelBtn.hidden = true;
}

document.getElementById("cancelButton")?.addEventListener("click", () => {
  resetForm();
  showMessage("Edit cancelled.");
});

function safeExternalURL(value) {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function renderItems(items) {
  if (!itemList) return;
  itemList.replaceChildren();

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = allItems.length
      ? "No portfolio items match these filters."
      : "No portfolio items yet. Add an achievement, activity, or project below.";
    itemList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const item of items) {
    const card = document.createElement("article");
    card.className = "item-card";
    const student = allStudents.find(
      entry => String(entry.id) === String(item.student_id)
    );
    const safeLink = safeExternalURL(item.link);
    const linkMarkup = safeLink
      ? `<a href="${escapeHTML(safeLink)}" target="_blank" rel="noopener noreferrer">Open link ↗</a>`
      : "";

    card.innerHTML = `
      <div class="item-card-heading">
        <span class="item-category">${escapeHTML(item.category)}</span>
        <span class="student-id">#${escapeHTML(item.id)}</span>
      </div>
      <h3>${escapeHTML(item.title)}</h3>
      <p class="item-student">${escapeHTML(student?.name || `Student #${item.student_id}`)}</p>
      <p class="item-description">${escapeHTML(item.description)}</p>
      ${item.technologies ? `<p class="item-technologies"><strong>Technologies:</strong> ${escapeHTML(item.technologies)}</p>` : ""}
      ${linkMarkup ? `<p class="item-link">${linkMarkup}</p>` : ""}
      <div class="card-actions">
        <button type="button" class="button button-light" data-action="edit">Edit</button>
        <button type="button" class="button button-danger" data-action="delete">Delete</button>
      </div>
    `;

    card.querySelector('[data-action="edit"]').addEventListener("click", () => {
      document.getElementById("itemId").value = item.id;
      document.getElementById("itemTitle").value = item.title;
      document.getElementById("itemDescription").value = item.description;
      document.getElementById("itemCategory").value = item.category;
      document.getElementById("itemTechnologies").value = item.technologies || "";
      document.getElementById("itemLink").value = item.link || "";
      document.getElementById("itemStudentId").value = String(item.student_id);
      document.getElementById("itemFormTitle").textContent = "Edit Portfolio Item";
      document.getElementById("saveItemButton").textContent = "Update Item";
      document.getElementById("cancelItemButton").hidden = false;
      showItemMessage(`Editing ${item.title}.`);
      document.getElementById("portfolioFormSection")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      document.getElementById("itemTitle")?.focus({ preventScroll: true });
    });

    card.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (!confirm(`Delete the portfolio item "${item.title}"?`)) return;

      try {
        await apiRequest(`${ITEMS_URL}/${encodeURIComponent(item.id)}`, {
          method: "DELETE"
        });
        showItemMessage("Portfolio item deleted.", "success");
        await loadItems();
      } catch (error) {
        showItemMessage(error.message || "Could not delete portfolio item.", "error");
      }
    });

    fragment.appendChild(card);
  }

  itemList.appendChild(fragment);
}

function filterItems() {
  const selectedStudent = itemStudentFilter ? itemStudentFilter.value : "";
  const selectedCategory = itemCategoryFilter ? itemCategoryFilter.value : "";
  const filteredItems = allItems.filter(item =>
    (!selectedStudent || String(item.student_id) === selectedStudent) &&
    (!selectedCategory || item.category === selectedCategory)
  );

  if (itemCount) {
    itemCount.textContent = `Showing ${filteredItems.length} of ${allItems.length} item${allItems.length === 1 ? "" : "s"}`;
  }
  renderItems(filteredItems);
}

async function loadItems() {
  if (isLoadingItems) return;

  isLoadingItems = true;
  const button = document.getElementById("refreshItemsButton");
  if (button) {
    button.disabled = true;
    button.textContent = "Loading...";
  }

  if (itemList) {
    itemList.replaceChildren();
    const loading = document.createElement("div");
    loading.className = "empty-state";
    loading.textContent = "Loading portfolio items...";
    itemList.appendChild(loading);
  }

  try {
    const items = await apiRequest(ITEMS_URL);
    if (!Array.isArray(items)) {
      throw new Error("Unexpected API response. Expected a portfolio item list.");
    }

    allItems = items;
    filterItems();
  } catch (error) {
    allItems = [];
    if (itemCount) itemCount.textContent = "Unable to load portfolio items";
    if (itemList) {
      itemList.replaceChildren();
      const errorState = document.createElement("div");
      errorState.className = "empty-state";
      errorState.textContent = error.message || "Could not load portfolio items.";
      itemList.appendChild(errorState);
    }
  } finally {
    isLoadingItems = false;
    if (button) {
      button.disabled = false;
      button.textContent = "↻ Refresh";
    }
  }
}

function resetItemForm() {
  if (itemForm) itemForm.reset();
  const itemIdEl = document.getElementById("itemId");
  if (itemIdEl) itemIdEl.value = "";
  
  const formTitle = document.getElementById("itemFormTitle");
  if (formTitle) formTitle.textContent = "Add Portfolio Item";

  const saveBtn = document.getElementById("saveItemButton");
  if (saveBtn) saveBtn.textContent = "Save Item";

  const cancelBtn = document.getElementById("cancelItemButton");
  if (cancelBtn) cancelBtn.hidden = true;
}

if (itemForm) {
  itemForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!itemForm.reportValidity()) return;

    const id = document.getElementById("itemId").value;
    const url = id ? `${ITEMS_URL}/${encodeURIComponent(id)}` : ITEMS_URL;
    const payload = {
      student_id: Number(document.getElementById("itemStudentId").value),
      title: document.getElementById("itemTitle").value.trim(),
      description: document.getElementById("itemDescription").value.trim(),
      category: document.getElementById("itemCategory").value,
      technologies: document.getElementById("itemTechnologies").value.trim() || null,
      link: document.getElementById("itemLink").value.trim() || null
    };
    const button = document.getElementById("saveItemButton");
    if (button) {
      button.disabled = true;
      button.textContent = id ? "Updating..." : "Saving...";
    }

    try {
      await apiRequest(url, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      showItemMessage(
        id ? "Portfolio item updated." : "Portfolio item added.",
        "success"
      );
      resetItemForm();
      await loadItems();
      document.getElementById("portfolioItems")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } catch (error) {
      showItemMessage(error.message || "Could not save portfolio item.", "error");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = document.getElementById("itemId").value
          ? "Update Item"
          : "Save Item";
      }
    }
  });
}

document.getElementById("cancelItemButton")?.addEventListener("click", () => {
  resetItemForm();
  showItemMessage("Edit cancelled.");
});

document.getElementById("refreshItemsButton")?.addEventListener("click", loadItems);
itemStudentFilter?.addEventListener("change", filterItems);
itemCategoryFilter?.addEventListener("change", filterItems);

document.getElementById("logoutButton")?.addEventListener("click", () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("student");
  window.location.replace("login.html");
});

searchInput?.addEventListener("input", filterStudents);
refreshButton?.addEventListener("click", loadStudents);

if (!accessToken) {
  window.location.replace("login.html");
} else {
  loadStudents();
  loadItems();
}