let currentUserId = null;
let currentCommentsPostId = null;
function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) { return null; }
}
document.getElementById('token').addEventListener('input', function() {
  const token = this.value;
  const payload = parseJwt(token);
  currentUserId = payload ? payload.id : null;
  loadPosts();
});
document.getElementById('createPostForm').onsubmit = async function(e) {
  e.preventDefault();
  const token = document.getElementById('token').value;
  const title = document.getElementById('title').value;
  const content = document.getElementById('content').value;
  // Robustly get the photo_url value
  const photoUrlInput = document.getElementById('photo_url');
  const photo_url = photoUrlInput ? photoUrlInput.value : '';
  const res = await fetch('/posts', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title, content, photo_url })
  });
  const data = await res.json();
  document.getElementById('createResult').innerText = data.message || (data.id ? 'Post created!' : JSON.stringify(data));
  if (res.ok) {
    document.getElementById('createPostForm').reset();
    loadPosts();
  }
};
function escapeQuotes(str) {
  return String(str).replace(/'/g, "&#39;").replace(/\"/g, "&quot;");
}
async function loadPosts() {
  const res = await fetch('/posts');
  const posts = await res.json();
  const token = document.getElementById('token').value;
  const payload = parseJwt(token);
  currentUserId = payload ? payload.id : null;
  let html = '';
  posts.forEach(function(post) {
    html += `<div style='border:1px solid #ccc; margin:10px; padding:10px;'>`;
    html += `<b>${escapeQuotes(post.title)}</b> by ${escapeQuotes(post.username)} <br/>`;
    html += `<small>Created: ${post.created_at}</small><br/>`;
    if (post.photo_url) {
      html += `<img src='${escapeQuotes(post.photo_url)}' alt='Post Photo' style='max-width:200px;max-height:200px;display:block;margin-bottom:4px;' onerror="this.style.display='none'" />`;
      html += `<div><a href='${escapeQuotes(post.photo_url)}' target='_blank'>${escapeQuotes(post.photo_url)}</a></div>`;
    }
    html += `<div>${escapeQuotes(post.content)}</div>`;
    html += `<div>👍 <span id='like-count-${post.id}'>${post.like_count}</span> | 💬 <span id='comment-count-${post.id}'>${post.comment_count}</span></div>`;
    if (currentUserId) {
      html += `<button onclick="toggleLike(${post.id})" id="like-btn-${post.id}">Like</button> `;
    }
    html += `<button onclick="showComments(${post.id})">Show Comments</button> `;
    if (currentUserId && post.user_id === currentUserId) {
      html += `<button onclick="editPost(${post.id}, ${JSON.stringify(post.title)}, ${JSON.stringify(post.content)})">Edit</button> `;
      html += `<button onclick="deletePost(${post.id})">Delete</button>`;
    }
    html += `</div>`;
  });
  document.getElementById('postsList').innerHTML = html;
  if (currentUserId) {
    posts.forEach(function(post) { checkLikeStatus(post.id); });
  }
}
window.loadPosts = loadPosts;
async function loadMyPosts() {
  const res = await fetch('/posts');
  const posts = await res.json();
  const token = document.getElementById('token').value;
  const payload = parseJwt(token);
  currentUserId = payload ? payload.id : null;
  let html = '';
  posts.forEach(function(post) {
    if (currentUserId && post.user_id === currentUserId) {
      html += `<div style='border:1px solid #ccc; margin:10px; padding:10px;'>`;
      html += `<b>${escapeQuotes(post.title)}</b> by ${escapeQuotes(post.username)} <br/>`;
      html += `<small>Created: ${post.created_at}</small><br/>`;
      if (post.photo_url) {
        html += `<img src='${escapeQuotes(post.photo_url)}' alt='Post Photo' style='max-width:200px;max-height:200px;display:block;margin-bottom:4px;' onerror="this.style.display='none'" />`;
        html += `<div><a href='${escapeQuotes(post.photo_url)}' target='_blank'>${escapeQuotes(post.photo_url)}</a></div>`;
      }
      html += `<div>${escapeQuotes(post.content)}</div>`;
      html += `<div>👍 <span id='like-count-${post.id}'>${post.like_count}</span> | 💬 <span id='comment-count-${post.id}'>${post.comment_count}</span></div>`;
      if (currentUserId) {
        html += `<button onclick="toggleLike(${post.id})" id="like-btn-${post.id}">Like</button> `;
      }
      html += `<button onclick="showComments(${post.id})">Show Comments</button> `;
      html += `<button onclick="editPost(${post.id}, ${JSON.stringify(post.title)}, ${JSON.stringify(post.content)})">Edit</button> `;
      html += `<button onclick="deletePost(${post.id})">Delete</button>`;
      html += `</div>`;
    }
  });
  document.getElementById('postsList').innerHTML = html;
  if (currentUserId) {
    posts.forEach(function(post) { checkLikeStatus(post.id); });
  }
}
window.loadMyPosts = loadMyPosts;
async function checkLikeStatus(postId) {
  const token = document.getElementById('token').value;
  if (!token) return;
  const res = await fetch(`/posts/${postId}/likes?user=1`, { headers: { 'Authorization': 'Bearer ' + token } });
  const data = await res.json();
  document.getElementById(`like-count-${postId}`).innerText = data.like_count;
  const likeBtn = document.getElementById(`like-btn-${postId}`);
  if (!likeBtn) return;
  if (data.liked) {
    likeBtn.innerText = 'Unlike';
  } else {
    likeBtn.innerText = 'Like';
  }
}
async function toggleLike(postId) {
  const token = document.getElementById('token').value;
  const likeBtn = document.getElementById(`like-btn-${postId}`);
  if (likeBtn.innerText === 'Like') {
    await fetch(`/posts/${postId}/like`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
  } else {
    await fetch(`/posts/${postId}/like`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
  }
  checkLikeStatus(postId);
  loadPosts();
}
async function showComments(postId) {
  currentCommentsPostId = postId;
  document.getElementById('commentsModal').style.display = '';
  document.getElementById('modalBackdrop').style.display = '';
  loadComments(postId);
}
function closeCommentsModal() {
  document.getElementById('commentsModal').style.display = 'none';
  document.getElementById('modalBackdrop').style.display = 'none';
  document.getElementById('commentsList').innerHTML = '';
  document.getElementById('commentResult').innerText = '';
  currentCommentsPostId = null;
}
window.closeCommentsModal = closeCommentsModal;
async function loadComments(postId) {
  const res = await fetch(`/posts/${postId}/comments`);
  const comments = await res.json();
  let html = '';
  comments.forEach(function(comment) {
    html += `<div style='border-bottom:1px solid #eee; margin-bottom:5px; padding-bottom:5px;'><b>${escapeQuotes(comment.username)}</b>: ${escapeQuotes(comment.content)} <small>(${comment.created_at})</small></div>`;
  });
  document.getElementById('commentsList').innerHTML = html;
  document.getElementById(`comment-count-${postId}`).innerText = comments.length;
}
document.getElementById('addCommentForm').onsubmit = async function(e) {
  e.preventDefault();
  const token = document.getElementById('token').value;
  const content = document.getElementById('commentContent').value;
  if (!currentCommentsPostId) return;
  const res = await fetch(`/posts/${currentCommentsPostId}/comments`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content })
  });
  const data = await res.json();
  document.getElementById('commentResult').innerText = data.message || (data.id ? 'Comment added!' : JSON.stringify(data));
  if (res.ok) {
    document.getElementById('addCommentForm').reset();
    loadComments(currentCommentsPostId);
    loadPosts();
  }
};
async function deletePost(id) {
  const token = document.getElementById('token').value;
  if (!confirm('Delete this post?')) return;
  const res = await fetch('/posts/' + id, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const data = await res.json();
  alert(data.message || JSON.stringify(data));
  loadPosts();
}
window.deletePost = deletePost;
window.editPost = function(id, title, content) {
  const newTitle = prompt('Edit title:', title);
  if (newTitle === null) return;
  const newContent = prompt('Edit content:', content);
  if (newContent === null) return;
  updatePost(id, newTitle, newContent);
};
async function updatePost(id, title, content) {
  const token = document.getElementById('token').value;
  const res = await fetch('/posts/' + id, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title, content })
  });
  const data = await res.json();
  alert(data.message || JSON.stringify(data));
  loadPosts();
}
// Initial load
loadPosts(); 