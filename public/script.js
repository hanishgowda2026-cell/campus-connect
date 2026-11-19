
/* ==========================================
   CAMPUS CONNECT + QUICKMEET
   COMPLETE FRONTEND JAVASCRIPT
========================================== */

const API = {
  posts: "/api/posts",
  meetups: "/api/meetups",
  auth: "/api/auth"
};

const MEETUP_CATEGORIES = [
  "Coffee & Chat",
  "Study Group",
  "Sports",
  "Food & Hangout",
  "Gaming",
  "Project Collaboration",
  "Campus Walk",
  "Other"
];

const POST_CATEGORIES = [
  "All",
  "Academic",
  "Events",
  "Sports",
  "Clubs",
  "Placements",
  "Internships",
  "Announcements",
  "Lost & Found",
  "Buy & Sell",
  "Hostel",
  "Food",
  "Technology",
  "General"
];

const state = {
  user: null,
  posts: [],
  activePostCategory: "All",
  search: "",
  meetups: [],
  meetupView: "discover",
  nearbyMode: false,
  coordinates: null,
  currentRequestsMeetupId: null,
  busy: false
};

// ==========================================
// DOM HELPERS
// ==========================================

const $ = (selector) => document.querySelector(selector);

function get(id) {
  return document.getElementById(id);
}

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]
  );
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function showToast(message, type = "info") {
  const container = get("toastContainer");

  if (!container) {
    console.log(message);
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.setAttribute("role", "status");

  const icon =
    type === "success"
      ? "check-circle"
      : type === "error"
        ? "alert-circle"
        : "info";

  toast.innerHTML = `
    <i data-lucide="${icon}"></i>
    <span>${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);
  refreshIcons();

  setTimeout(() => {
    toast.remove();
  }, 4500);
}

function setLoading(button, loading, label = "Please wait...") {
  if (!button) return;

  if (loading) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;

    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }

    refreshIcons();
  }
}

// ==========================================
// API REQUESTS
// ==========================================

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  const contentType = response.headers.get("content-type") || "";

  let data;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();

    throw new Error(
      response.ok
        ? "Unexpected server response."
        : `Server error (${response.status}): ${text.slice(0, 100)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
      data.error ||
      `Request failed (${response.status})`
    );
  }

  return data;
}

function jsonOptions(method, body) {
  return {
    method,
    body: JSON.stringify(body)
  };
}

// ==========================================
// MODAL MANAGEMENT
// ==========================================

function openModal(id) {
  const modal = get(id);

  if (!modal) return;

  document.querySelectorAll(".modal-overlay").forEach(
    (item) => {
      item.hidden = true;
    }
  );

  modal.hidden = false;
  document.body.classList.add("modal-open");

  const firstInput = modal.querySelector(
    "input, textarea, select"
  );

  if (firstInput) {
    setTimeout(() => firstInput.focus(), 50);
  }

  refreshIcons();
}

function closeModal(id) {
  const modal = get(id);

  if (modal) {
    modal.hidden = true;
  }

  const anyOpen = Array.from(
    document.querySelectorAll(".modal-overlay")
  ).some((item) => !item.hidden);

  if (!anyOpen) {
    document.body.classList.remove("modal-open");
  }
}

function closeAllModals() {
  document.querySelectorAll(".modal-overlay").forEach(
    (modal) => {
      modal.hidden = true;
    }
  );

  document.body.classList.remove("modal-open");
}

function requireLogin() {
  if (state.user) {
    return true;
  }

  showToast("Please log in to continue.", "info");
  openModal("loginModal");

  return false;
}

// ==========================================
// AUTHENTICATION
// ==========================================

function updateAuthUI() {
  const loggedIn = Boolean(state.user);

  get("guestActions").hidden = loggedIn;
  get("userActions").hidden = !loggedIn;

  if (loggedIn) {
    get("navUserName").textContent = state.user.name;
  } else {
    get("navUserName").textContent = "";
  }
}

async function loadCurrentUser() {
  try {
    const result = await apiRequest(`${API.auth}/me`);

    state.user = result.user || null;
  } catch {
    state.user = null;
  }

  updateAuthUI();
}

async function login(event) {
  event.preventDefault();

  const button = get("loginSubmitBtn");

  const email = get("loginEmail").value.trim();
  const password = get("loginPassword").value;

  setLoading(button, true, "Logging in...");

  try {
    const result = await apiRequest(
      `${API.auth}/login`,
      jsonOptions("POST", {
        email,
        password
      })
    );

    state.user = result.user;

    updateAuthUI();
    closeAllModals();

    get("loginForm").reset();

    showToast("Logged in successfully!", "success");

    await refreshMeetups();

  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setLoading(button, false);
  }
}

async function register(event) {
  event.preventDefault();

  const button = get("registerSubmitBtn");

  const payload = {
    name: get("registerName").value.trim(),
    email: get("registerEmail").value.trim(),
    college: get("registerCollege").value.trim(),
    studentId: get("registerStudentId").value.trim(),
    password: get("registerPassword").value
  };

  setLoading(button, true, "Creating account...");

  try {
    const result = await apiRequest(
      `${API.auth}/register`,
      jsonOptions("POST", payload)
    );

    state.user = result.user;

    updateAuthUI();
    closeAllModals();

    get("registerForm").reset();

    showToast(
      "Account created! Welcome to Campus Connect.",
      "success"
    );

    await refreshMeetups();

  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setLoading(button, false);
  }
}

async function logout() {
  try {
    await apiRequest(
      `${API.auth}/logout`,
      { method: "POST" }
    );

    state.user = null;
    state.meetupView = "discover";

    updateAuthUI();
    updateMeetupTabs();

    showToast("Logged out successfully.", "success");

    await refreshMeetups();

  } catch (error) {
    showToast(error.message, "error");
  }
}

// ==========================================
// CAMPUS POSTS
// ==========================================

function normalizePosts(result) {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result.posts)) {
    return result.posts;
  }

  if (Array.isArray(result.data)) {
    return result.data;
  }

  return [];
}

function postCategory(post) {
  return (
    post.category ||
    post.aiCategory ||
    post.predictedCategory ||
    "General"
  );
}

function postLikes(post) {
  if (Array.isArray(post.likes)) {
    return post.likes.length;
  }

  return Number(
    post.likesCount ??
    post.likeCount ??
    post.likes ??
    0
  ) || 0;
}

async function loadPosts() {
  const container = get("postsContainer");

  try {
    const result = await apiRequest(API.posts);

    state.posts = normalizePosts(result);

    renderPosts();
    renderDashboard();
    renderTrendingCategories();

  } catch (error) {
    console.error("Load posts error:", error);

    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="alert-circle"></i>
        <h3>Unable to load posts</h3>
        <p>${escapeHTML(error.message)}</p>
      </div>
    `;

    refreshIcons();
  }
}

function renderDashboard() {
  const posts = state.posts;

  const categories = new Set(
    posts.map((post) => postCategory(post))
  );

  const likes = posts.reduce(
    (total, post) => total + postLikes(post),
    0
  );

  get("totalPosts").textContent = posts.length;
  get("totalCategories").textContent = "13";
  get("totalLikes").textContent = likes;
  get("activeCategories").textContent = categories.size;
}

function renderPostFilters() {
  const container = get("categoryFilters");

  container.innerHTML = POST_CATEGORIES.map(
    (category) => `
      <button
        type="button"
        class="category-chip ${
          state.activePostCategory === category
            ? "active"
            : ""
        }"
        data-post-category="${escapeHTML(category)}"
      >
        ${escapeHTML(category)}
      </button>
    `
  ).join("");
}

function renderPosts() {
  const container = get("postsContainer");

  const filtered = state.posts.filter((post) => {
    const category = postCategory(post);

    const matchesCategory =
      state.activePostCategory === "All" ||
      category.toLowerCase() ===
        state.activePostCategory.toLowerCase();

    const text = [
      post.title,
      post.content,
      post.description,
      category
    ].join(" ").toLowerCase();

    const matchesSearch = text.includes(
      state.search.toLowerCase()
    );

    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="inbox"></i>
        <h3>No posts found</h3>
        <p>
          Try another category or be the first
          to share a campus update.
        </p>
      </div>
    `;

    refreshIcons();
    return;
  }

  container.innerHTML = filtered.map((post) => {
    const id = post._id || post.id;
    const title = post.title || "Campus Update";
    const content =
      post.content || post.description || "";

    const author =
      post.authorName ||
      post.author ||
      post.username ||
      "Campus Student";

    const category = postCategory(post);

    const createdAt =
      post.createdAt ||
      post.timestamp ||
      post.date;

    return `
      <article class="post-card">

        <div class="post-header">

          <div class="post-author">
            <div class="post-avatar">
              ${escapeHTML(String(author).charAt(0).toUpperCase())}
            </div>

            <div>
              <strong>${escapeHTML(author)}</strong>
              <p class="post-date">
                ${escapeHTML(formatDate(createdAt))}
              </p>
            </div>
          </div>

          <span class="post-category">
            ${escapeHTML(category)}
          </span>

        </div>

        <h3 class="post-title">
          ${escapeHTML(title)}
        </h3>

        <p class="post-content">
          ${escapeHTML(content)}
        </p>

        <div class="post-footer">

          <button
            type="button"
            class="like-btn"
            data-like-post="${escapeHTML(id)}"
          >
            <i data-lucide="heart"></i>
            <span>${postLikes(post)}</span>
            Likes
          </button>

          <span class="ai-badge">
            <i data-lucide="sparkles"></i>
            AI Categorized
          </span>

        </div>

      </article>
    `;
  }).join("");

  refreshIcons();
}

function renderTrendingCategories() {
  const counts = new Map();

  state.posts.forEach((post) => {
    const category = postCategory(post);

    counts.set(
      category,
      (counts.get(category) || 0) + 1
    );
  });

  const trending = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const container = get("trendingCategories");

  if (trending.length === 0) {
    container.innerHTML = `
      <p>No trending categories yet.</p>
    `;
    return;
  }

  container.innerHTML = trending.map(
    ([category, count]) => `
      <div class="trending-item">
        <span>${escapeHTML(category)}</span>
        <span class="trending-count">
          ${count}
        </span>
      </div>
    `
  ).join("");
}

async function publishPost(event) {
  event.preventDefault();

  const title = get("postTitle").value.trim();
  const content = get("postContent").value.trim();

  if (!title || !content) {
    showToast("Enter a title and description.", "error");
    return;
  }

  const button = get("publishButton");

  setLoading(button, true, "AI is analyzing...");

  get("aiAnalysisStatus").textContent =
    "AI is detecting the category...";

  try {
    const result = await apiRequest(
      API.posts,
      jsonOptions("POST", {
        title,
        content
      })
    );

    get("postForm").reset();

    const category =
      result.category ||
      result.post?.category ||
      "AI detected";

    showToast(
      `Post published! Category: ${category}`,
      "success"
    );

    await loadPosts();

  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setLoading(button, false);

    get("aiAnalysisStatus").textContent =
      "AI category detection ready";
  }
}

async function likePost(postId) {
  try {
    await apiRequest(
      `${API.posts}/${encodeURIComponent(postId)}/like`,
      { method: "POST" }
    );

    await loadPosts();

  } catch (error) {
    showToast(error.message, "error");
  }
}

// ==========================================
// GEOLOCATION
// ==========================================

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error(
        "Geolocation is not supported by this browser."
      ));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        let message = "Unable to access your location.";

        if (error.code === 1) {
          message = "Location permission was denied.";
        } else if (error.code === 2) {
          message = "Your location is unavailable.";
        } else if (error.code === 3) {
          message = "Location request timed out.";
        }

        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });
}

function setLocationStatus(message) {
  const element = get("locationStatus");

  element.textContent = message;
}

async function findNearbyMeetups() {
  const button = get("findNearbyBtn");

  setLoading(button, true, "Finding location...");

  try {
    const coordinates = await getLocation();

    state.coordinates = coordinates;
    state.nearbyMode = true;
    state.meetupView = "discover";

    updateMeetupTabs();

    setLocationStatus(
      "Searching around your location. Your live GPS position is not shown to other students."
    );

    await refreshMeetups();

    showToast(
      "Nearby meetups loaded successfully.",
      "success"
    );

  } catch (error) {
    showToast(error.message, "error");

    setLocationStatus(
      "Location unavailable. You can still browse all meetups."
    );
  } finally {
    setLoading(button, false);
  }
}

async function useCurrentLocation() {
  const button = get("useLocationBtn");

  setLoading(button, true, "Getting GPS...");

  try {
    const coordinates = await getLocation();

    get("meetupLatitude").value =
      coordinates.lat.toFixed(6);

    get("meetupLongitude").value =
      coordinates.lng.toFixed(6);

    showToast(
      "Coordinates filled. Confirm this is a public meeting point before creating the meetup.",
      "info"
    );

  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setLoading(button, false);
  }
}

// ==========================================
// QUICKMEET DATA
// ==========================================

function updateMeetupTabs() {
  const discover = get("discoverMeetupsTab");
  const mine = get("myMeetupsTab");

  const isDiscover =
    state.meetupView === "discover";

  discover.classList.toggle("active", isDiscover);
  mine.classList.toggle("active", !isDiscover);

  discover.setAttribute(
    "aria-pressed",
    String(isDiscover)
  );

  mine.setAttribute(
    "aria-pressed",
    String(!isDiscover)
  );
}

async function refreshMeetups() {
  const container = get("meetupsContainer");

  container.innerHTML = `
    <div class="quickmeet-empty-state">
      <i data-lucide="loader-circle"></i>
      <p>Loading meetups...</p>
    </div>
  `;

  refreshIcons();

  try {
    let url;

    if (state.meetupView === "mine") {
      if (!state.user) {
        state.meetupView = "discover";
        updateMeetupTabs();
      }
    }

    if (state.meetupView === "mine") {
      url = `${API.meetups}/mine`;
    } else if (
      state.nearbyMode &&
      state.coordinates
    ) {
      const { lat, lng } = state.coordinates;
      const radius = get("meetupRadius").value;

      const params = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        radius
      });

      const category =
        get("meetupCategoryFilter").value;

      if (category) {
        params.set("category", category);
      }

      url = `${API.meetups}/nearby?${params}`;
    } else {
      const params = new URLSearchParams();

      const category =
        get("meetupCategoryFilter").value;

      if (category) {
        params.set("category", category);
      }

      url = `${API.meetups}?${params}`;
    }

    const result = await apiRequest(url);

    state.meetups = Array.isArray(result)
      ? result
      : result.meetups || [];

    renderMeetups();

  } catch (error) {
    console.error("QuickMeet error:", error);

    container.innerHTML = `
      <div class="quickmeet-empty-state">
        <i data-lucide="alert-circle"></i>
        <h3>Unable to load meetups</h3>
        <p>${escapeHTML(error.message)}</p>
      </div>
    `;

    refreshIcons();
  }
}

function categoryIcon(category) {
  const icons = {
    "Coffee & Chat": "coffee",
    "Study Group": "book-open",
    "Sports": "trophy",
    "Food & Hangout": "utensils",
    "Gaming": "gamepad-2",
    "Project Collaboration": "laptop",
    "Campus Walk": "footprints",
    "Other": "users"
  };

  return icons[category] || "users";
}

function meetupStatus(meetup) {
  if (meetup.status === "Cancelled") {
    return {
      text: "Cancelled",
      className: "cancelled"
    };
  }

  if (new Date(meetup.endTime) <= new Date()) {
    return {
      text: "Completed",
      className: "cancelled"
    };
  }

  if (
    meetup.availableSpots <= 0 ||
    meetup.status === "Full"
  ) {
    return {
      text: "Full",
      className: "full"
    };
  }

  return {
    text: "Open",
    className: ""
  };
}

function meetupButtons(meetup) {
  const id = escapeHTML(meetup._id);

  if (meetup.isOrganizer) {
    const buttons = [];

    if (
      meetup.status === "Open" &&
      new Date(meetup.endTime) > new Date()
    ) {
      buttons.push(`
        <button
          type="button"
          class="btn btn-outline"
          data-manage-requests="${id}"
        >
          Requests (${Number(meetup.pendingRequestCount) || 0})
        </button>
      `);

      buttons.push(`
        <button
          type="button"
          class="btn btn-outline"
          data-cancel-meetup="${id}"
        >
          Cancel
        </button>
      `);
    }

    return buttons.join("");
  }

  if (meetup.isParticipant) {
    return `
      <button class="btn btn-outline" disabled>
        Joined
      </button>
    `;
  }

  if (meetup.hasRequested) {
    return `
      <button class="btn btn-outline" disabled>
        Request Pending
      </button>
    `;
  }

  if (
    meetup.status !== "Open" ||
    meetup.availableSpots <= 0 ||
    new Date(meetup.endTime) <= new Date()
  ) {
    return `
      <button class="btn btn-outline" disabled>
        Unavailable
      </button>
    `;
  }

  return `
    <button
      type="button"
      class="btn btn-primary"
      data-join-meetup="${id}"
    >
      Request to Join
    </button>
  `;
}

function renderMeetups() {
  const container = get("meetupsContainer");

  if (state.meetups.length === 0) {
    const isMine = state.meetupView === "mine";

    container.innerHTML = `
      <div class="quickmeet-empty-state">
        <i data-lucide="map-pin"></i>

        <h3>
          ${isMine
            ? "No meetups yet"
            : "No meetups found"}
        </h3>

        <p>
          ${isMine
            ? "Create a meetup or request to join an activity."
            : "Try another category, a larger radius, or create the first meetup."}
        </p>
      </div>
    `;

    refreshIcons();
    return;
  }

  container.innerHTML = state.meetups.map((meetup) => {
    const status = meetupStatus(meetup);

    const distance =
      Number.isFinite(meetup.distanceMeters)
        ? `
          <div class="meetup-detail meetup-distance">
            <i data-lucide="radar"></i>
            ${meetup.distanceMeters} meters away
          </div>
        `
        : "";

    const participants =
      Number(meetup.participantCount) || 0;

    const capacity =
      Number(meetup.maxParticipants) || 0;

    return `
      <article class="meetup-card">

        <div class="meetup-card-header">

          <div class="meetup-category-icon">
            <i data-lucide="${categoryIcon(meetup.category)}"></i>
          </div>

          <span class="meetup-status ${status.className}">
            ${status.text}
          </span>

        </div>

        <span class="meetup-category-label">
          ${escapeHTML(meetup.category)}
        </span>

        <h3>${escapeHTML(meetup.title)}</h3>

        <p class="meetup-description">
          ${escapeHTML(meetup.description)}
        </p>

        <div class="meetup-details">

          <div class="meetup-detail">
            <i data-lucide="user"></i>
            ${escapeHTML(meetup.organizerName)}
          </div>

          <div class="meetup-detail">
            <i data-lucide="map-pin"></i>
            ${escapeHTML(meetup.meetingPoint)}
          </div>

          <div class="meetup-detail">
            <i data-lucide="calendar-clock"></i>
            ${escapeHTML(formatDate(meetup.startTime))}
          </div>

          ${distance}

        </div>

        <div class="meetup-card-footer">

          <span class="meetup-spots">
            <strong>${participants}/${capacity}</strong>
            participants
          </span>

          <div class="meetup-actions">
            ${meetupButtons(meetup)}
          </div>

        </div>

      </article>
    `;
  }).join("");

  refreshIcons();
}

// ==========================================
// CREATE MEETUP
// ==========================================

function openCreateMeetup() {
  if (!requireLogin()) return;

  openModal("createMeetupModal");
}

async function createMeetup(event) {
  event.preventDefault();

  if (!requireLogin()) return;

  const button = get("createMeetupSubmitBtn");

  const startTime = new Date(
    get("meetupStartTime").value
  );

  const endTime = new Date(
    get("meetupEndTime").value
  );

  if (
    Number.isNaN(startTime.getTime()) ||
    Number.isNaN(endTime.getTime())
  ) {
    showToast("Enter valid meetup times.", "error");
    return;
  }

  if (startTime <= new Date()) {
    showToast(
      "Meetup start time must be in the future.",
      "error"
    );
    return;
  }

  if (endTime <= startTime) {
    showToast(
      "End time must be after start time.",
      "error"
    );
    return;
  }

  const payload = {
    title: get("meetupTitle").value.trim(),
    description: get("meetupDescription").value.trim(),
    category: get("meetupCategory").value,
    meetingPoint: get("meetupMeetingPoint").value.trim(),
    latitude: Number(get("meetupLatitude").value),
    longitude: Number(get("meetupLongitude").value),
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    maxParticipants: Number(
      get("meetupMaxParticipants").value
    )
  };

  setLoading(button, true, "Creating meetup...");

  try {
    await apiRequest(
      API.meetups,
      jsonOptions("POST", payload)
    );

    get("createMeetupForm").reset();
    closeModal("createMeetupModal");

    state.nearbyMode = false;
    state.meetupView = "mine";

    updateMeetupTabs();

    showToast(
      "Meetup created successfully!",
      "success"
    );

    await refreshMeetups();

    get("quickmeet").scrollIntoView({
      behavior: "smooth"
    });

  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setLoading(button, false);
  }
}

// ==========================================
// REQUEST TO JOIN
// ==========================================

async function joinMeetup(id) {
  if (!requireLogin()) return;

  try {
    const result = await apiRequest(
      `${API.meetups}/${encodeURIComponent(id)}/join`,
      { method: "POST" }
    );

    showToast(
      result.message || "Join request sent!",
      "success"
    );

    await refreshMeetups();

  } catch (error) {
    showToast(error.message, "error");
  }
}

// ==========================================
// ORGANIZER REQUEST MANAGEMENT
// ==========================================

async function openJoinRequests(id) {
  if (!requireLogin()) return;

  state.currentRequestsMeetupId = id;

  openModal("requestsModal");

  const container = get("joinRequestsContainer");

  container.innerHTML = "<p>Loading requests...</p>";

  try {
    const requests = await apiRequest(
      `${API.meetups}/${encodeURIComponent(id)}/requests`
    );

    if (!Array.isArray(requests) || requests.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="users"></i>
          <h3>No pending requests</h3>
          <p>New join requests will appear here.</p>
        </div>
      `;

      refreshIcons();
      return;
    }

    container.innerHTML = requests.map((request) => {
      const student = request.student;

      return `
        <div class="join-request-card">

          <div class="join-request-info">
            <h4>${escapeHTML(student.name)}</h4>

            <p>
              ${escapeHTML(student.college || "Student")}
            </p>

            <p>
              Requested:
              ${escapeHTML(formatDate(request.requestedAt))}
            </p>
          </div>

          <div class="join-request-actions">

            <button
              type="button"
              class="btn btn-approve"
              data-review-student="${escapeHTML(student.id)}"
              data-review-action="approve"
            >
              Approve
            </button>

            <button
              type="button"
              class="btn btn-reject"
              data-review-student="${escapeHTML(student.id)}"
              data-review-action="reject"
            >
              Reject
            </button>

          </div>

        </div>
      `;
    }).join("");

    refreshIcons();

  } catch (error) {
    container.innerHTML = `
      <p>${escapeHTML(error.message)}</p>
    `;
  }
}

async function reviewJoinRequest(studentId, action) {
  const meetupId = state.currentRequestsMeetupId;

  if (!meetupId) return;

  try {
    const result = await apiRequest(
      `${API.meetups}/${encodeURIComponent(meetupId)}/requests/${encodeURIComponent(studentId)}`,
      jsonOptions("POST", { action })
    );

    showToast(result.message, "success");

    await openJoinRequests(meetupId);
    await refreshMeetups();

  } catch (error) {
    showToast(error.message, "error");
  }
}

// ==========================================
// CANCEL MEETUP
// ==========================================

async function cancelMeetup(id) {
  if (!requireLogin()) return;

  const confirmed = window.confirm(
    "Are you sure you want to cancel this meetup?"
  );

  if (!confirmed) return;

  try {
    const result = await apiRequest(
      `${API.meetups}/${encodeURIComponent(id)}/cancel`,
      { method: "PATCH" }
    );

    showToast(
      result.message || "Meetup cancelled.",
      "success"
    );

    await refreshMeetups();

  } catch (error) {
    showToast(error.message, "error");
  }
}

// ==========================================
// NAVIGATION
// ==========================================

function updateActiveNavigation() {
  const hash = window.location.hash;

  let active = "home";

  if (hash === "#campus-feed") {
    active = "feed";
  } else if (hash === "#quickmeet") {
    active = "quickmeet";
  }

  document.querySelectorAll("[data-nav]").forEach(
    (link) => {
      link.classList.toggle(
        "active",
        link.dataset.nav === active
      );
    }
  );
}

// ==========================================
// EVENT LISTENERS
// ==========================================

function setupEventListeners() {

  // Authentication

  get("openLoginBtn").addEventListener(
    "click",
    () => openModal("loginModal")
  );

  get("openRegisterBtn").addEventListener(
    "click",
    () => openModal("registerModal")
  );

  get("switchToRegisterBtn").addEventListener(
    "click",
    () => openModal("registerModal")
  );

  get("switchToLoginBtn").addEventListener(
    "click",
    () => openModal("loginModal")
  );

  get("loginForm").addEventListener(
    "submit",
    login
  );

  get("registerForm").addEventListener(
    "submit",
    register
  );

  get("logoutBtn").addEventListener(
    "click",
    logout
  );

  // Close modals

  document.querySelectorAll("[data-close-modal]").forEach(
    (button) => {
      button.addEventListener("click", () => {
        closeModal(button.dataset.closeModal);
      });
    }
  );

  document.querySelectorAll(".modal-overlay").forEach(
    (overlay) => {
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          closeModal(overlay.id);
        }
      });
    }
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllModals();
    }
  });

  // Campus feed

  get("postForm").addEventListener(
    "submit",
    publishPost
  );

  get("searchInput").addEventListener(
    "input",
    (event) => {
      state.search = event.target.value;
      renderPosts();
    }
  );

  get("clearSearchBtn").addEventListener(
    "click",
    () => {
      get("searchInput").value = "";
      state.search = "";
      renderPosts();
    }
  );

  get("categoryFilters").addEventListener(
    "click",
    (event) => {
      const button = event.target.closest(
        "[data-post-category]"
      );

      if (!button) return;

      state.activePostCategory =
        button.dataset.postCategory;

      renderPostFilters();
      renderPosts();
    }
  );

  get("postsContainer").addEventListener(
    "click",
    (event) => {
      const button = event.target.closest(
        "[data-like-post]"
      );

      if (!button) return;

      likePost(button.dataset.likePost);
    }
  );

  // QuickMeet

  get("openCreateMeetupBtn").addEventListener(
    "click",
    openCreateMeetup
  );

  get("createMeetupForm").addEventListener(
    "submit",
    createMeetup
  );

  get("findNearbyBtn").addEventListener(
    "click",
    findNearbyMeetups
  );

  get("showAllMeetupsBtn").addEventListener(
    "click",
    async () => {
      state.nearbyMode = false;
      state.meetupView = "discover";

      updateMeetupTabs();
      await refreshMeetups();
    }
  );

  get("meetupRadius").addEventListener(
    "change",
    () => {
      if (state.nearbyMode) {
        refreshMeetups();
      }
    }
  );

  get("meetupCategoryFilter").addEventListener(
    "change",
    () => {
      if (state.meetupView === "discover") {
        refreshMeetups();
      }
    }
  );

  get("discoverMeetupsTab").addEventListener(
    "click",
    async () => {
      state.meetupView = "discover";
      updateMeetupTabs();
      await refreshMeetups();
    }
  );

  get("myMeetupsTab").addEventListener(
    "click",
    async () => {
      if (!requireLogin()) return;

      state.meetupView = "mine";
      updateMeetupTabs();

      await refreshMeetups();
    }
  );

  get("useLocationBtn").addEventListener(
    "click",
    useCurrentLocation
  );

  get("meetupsContainer").addEventListener(
    "click",
    (event) => {
      const join = event.target.closest(
        "[data-join-meetup]"
      );

      if (join) {
        joinMeetup(join.dataset.joinMeetup);
        return;
      }

      const manage = event.target.closest(
        "[data-manage-requests]"
      );

      if (manage) {
        openJoinRequests(manage.dataset.manageRequests);
        return;
      }

      const cancel = event.target.closest(
        "[data-cancel-meetup]"
      );

      if (cancel) {
        cancelMeetup(cancel.dataset.cancelMeetup);
      }
    }
  );

  get("joinRequestsContainer").addEventListener(
    "click",
    (event) => {
      const button = event.target.closest(
        "[data-review-student]"
      );

      if (!button) return;

      reviewJoinRequest(
        button.dataset.reviewStudent,
        button.dataset.reviewAction
      );
    }
  );

  window.addEventListener(
    "hashchange",
    updateActiveNavigation
  );
}

// ==========================================
// INITIALIZATION
// ==========================================

async function initializeApp() {
  setupEventListeners();

  renderPostFilters();
  updateMeetupTabs();
  updateActiveNavigation();

  refreshIcons();

  await Promise.all([
    loadCurrentUser(),
    loadPosts()
  ]);

  await refreshMeetups();

  console.log(
    "Campus Connect + QuickMeet initialized."
  );
}

document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);
