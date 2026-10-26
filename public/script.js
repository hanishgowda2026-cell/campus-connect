
const postForm = document.getElementById("postForm");
const postTitle = document.getElementById("postTitle");
const postContent = document.getElementById("postContent");
const postsContainer = document.getElementById("postsContainer");
const searchInput = document.getElementById("searchInput");

let allPosts = [];

// Prevent user content from being interpreted as HTML
function escapeHTML(value) {
  const entities = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  return String(value).replace(/[&<>"']/g, character => entities[character]);
}

// Display posts on the page
function renderPosts(posts) {
  if (posts.length === 0) {
    postsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✦</div>
        <h3>No posts found</h3>
        <p>Try another search or publish the first post.</p>
      </div>
    `;
    return;
  }

  postsContainer.innerHTML = posts.map(post => `
    <article class="post-card">
      <div class="post-top">
        <div class="post-avatar">S</div>
        <div>
          <div class="post-author">
            ${escapeHTML(post.author || "Student")}
          </div>
          <div class="post-date">
            ${new Date(post.createdAt).toLocaleString()}
          </div>
        </div>
      </div>

      <h3>${escapeHTML(post.title)}</h3>
      <p class="post-content">${escapeHTML(post.content)}</p>

      <div class="post-actions">
        <span>♥ ${Number(post.likes) || 0} likes</span>
        <span>Campus Connect</span>
      </div>
    </article>
  `).join("");
}

// Fetch posts from the backend
async function loadPosts() {
  postsContainer.innerHTML = "<p>Loading posts...</p>";

  try {
    const response = await fetch("/api/posts");

    if (!response.ok) {
      throw new Error("Could not load posts");
    }

    allPosts = await response.json();
    filterPosts();
  } catch (error) {
    postsContainer.innerHTML = `
      <div class="empty-state">
        <h3>Couldn't load posts</h3>
        <p>Check the server and refresh the page.</p>
      </div>
    `;

    console.error("Load posts error:", error);
  }
}

// Search posts by title or content
function filterPosts() {
  const query = searchInput.value.trim().toLowerCase();

  const filteredPosts = allPosts.filter(post =>
    post.title.toLowerCase().includes(query) ||
    post.content.toLowerCase().includes(query)
  );

  renderPosts(filteredPosts);
}

searchInput.addEventListener("input", filterPosts);

// Publish a new post
postForm.addEventListener("submit", async event => {
  event.preventDefault();

  const title = postTitle.value.trim();
  const content = postContent.value.trim();

  if (!title || !content) {
    alert("Please enter both a title and a message.");
    return;
  }

  const submitButton = postForm.querySelector('button[type="submit"]');

  submitButton.disabled = true;
  submitButton.textContent = "Publishing...";

  try {
    const response = await fetch("/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ title, content })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to publish post");
    }

    postForm.reset();
    await loadPosts();
  } catch (error) {
    alert(error.message);
    console.error("Publish post error:", error);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Publish Post ↗";
  }
});

// Load posts when the page opens
loadPosts();
