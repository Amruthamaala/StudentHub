const API_URL = "http://localhost:5000/api";

// Registration Function
async function register() {
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value.trim();
  const college = document.getElementById("regCollege").value.trim();
  const branch = document.getElementById("regBranch").value.trim();
  const skills = document.getElementById("regSkills").value.trim();

  try {
    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, college, branch, skills })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "❌ Registration failed.");
    
    localStorage.setItem("currentUser", JSON.stringify(data));
    alert("🎉 Account created successfully! Welcome to Student Hub.");
    window.location.href = "dashboard.html";
  } catch (err) { alert("Cannot connect to server."); }
}

async function login() {
  const emailInput = document.getElementById("email").value.trim();
  const passwordInput = document.getElementById("password").value.trim();
  try {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailInput, password: passwordInput })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "❌ Invalid details.");
    localStorage.setItem("currentUser", JSON.stringify(data));
    window.location.href = "dashboard.html";
  } catch (err) { alert("Cannot connect to backend server."); }
}

function logout() { localStorage.removeItem("currentUser"); window.location.href = "index.html"; }

function verifySession() {
  const session = localStorage.getItem("currentUser");
  if (!session) { window.location.href = "index.html"; return null; }
  return JSON.parse(session);
}

function loadProfilePage() {
  const user = verifySession(); if (!user) return;
  document.getElementById("myCollegeInput").value = user.college || "";
  document.getElementById("myBranchInput").value = user.branch || "";
  document.getElementById("mySkillsInput").value = user.skills ? user.skills.join(", ") : "";
  document.getElementById("myBioInput").value = user.bio || "";
}

async function updateProfile() {
  const user = verifySession(); if (!user) return;
  const college = document.getElementById("myCollegeInput").value.trim();
  const branch = document.getElementById("myBranchInput").value.trim();
  const skillsInput = document.getElementById("mySkillsInput").value;
  const bio = document.getElementById("myBioInput").value.trim();

  const skills = skillsInput ? skillsInput.split(",").map(s => s.trim()).filter(Boolean) : [];

  try {
    const res = await fetch(`${API_URL}/students/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, skills, college, branch, bio })
    });
    
    if (res.ok) {
      const updatedUser = await res.json();
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
      alert("✅ Profile details updated!");
    }
  } catch (err) { alert("Error saving profile."); }
}

async function searchStudents() {
  const term = document.getElementById("skillSearchInput").value.trim();
  const box = document.getElementById("studentSearchResults");
  if (!term) { box.innerHTML = "<p style='color: var(--text-muted); font-size: 14px;'>Type a skill above to query candidates...</p>"; return; }
  try {
    const res = await fetch(`${API_URL}/students/search?skill=${term}`);
    const hits = await res.json();
    if (hits.length === 0) { box.innerHTML = "<p style='color: var(--text-muted); font-size: 14px;'>No matching students found.</p>"; return; }
    box.innerHTML = hits.map(st => `
      <div style="padding:10px; border-bottom:1px solid var(--border); font-size:13px;">
        <strong>${st.name}</strong> <span class="branch-badge">${st.branch || 'General'}</span><br>
        <span style="color:var(--text-muted);">${st.college || ''}</span><br>
        <span style="color:#4f46e5;">Skills: ${st.skills && st.skills.length ? st.skills.join(", ") : "None"}</span>
      </div>
    `).join("");
  } catch (err) { console.error(err); }
}

async function createNewProject() {
  const title = document.getElementById("projTitle").value.trim();
  const description = document.getElementById("projDesc").value.trim();
  const skillsInput = document.getElementById("projSkills").value;
  const slots = document.getElementById("projSlots").value;
  const user = verifySession(); if (!user) return;
  
  if (!title || !slots || !description) return alert("Fill out title, description, and developer slots!");
  const skillsNeeded = skillsInput ? skillsInput.split(",").map(s => s.trim()).filter(Boolean) : ["General"];

  try {
    const res = await fetch(`${API_URL}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, skillsNeeded, slotsAllocated: parseInt(slots), creatorEmail: user.email, creatorName: user.name })
    });
    if (res.ok) { 
      document.getElementById("projTitle").value = "";
      document.getElementById("projDesc").value = "";
      document.getElementById("projSkills").value = "";
      document.getElementById("projSlots").value = "";
      renderDashboardFeeds(); 
    }
  } catch (err) { console.error(err); }
}

async function deleteProject(id) {
  if (confirm("Remove this project post?")) {
    await fetch(`${API_URL}/projects/${id}`, { method: "DELETE" });
    renderDashboardFeeds();
  }
}

async function applyForProject(id) {
  const user = verifySession(); if (!user) return;
  const res = await fetch(`${API_URL}/projects/${id}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, name: user.name })
  });
  if (!res.ok) { const d = await res.json(); alert(d.error); return; }
  renderDashboardFeeds();
}

async function processApplicant(projectId, applicantEmail, outcome) {
  await fetch(`${API_URL}/projects/${projectId}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ applicantEmail, outcome })
  });
  renderDashboardFeeds();
}

function initDashboard() { verifySession(); renderDashboardFeeds(); }

async function renderDashboardFeeds() {
  const user = JSON.parse(localStorage.getItem("currentUser")); if (!user) return;
  let projects = [];
  try { const res = await fetch(`${API_URL}/projects`); projects = await res.json(); } catch (e) { return; }

  // Filter projects based on user search input
  const filterInput = document.getElementById("projectFilterInput");
  const filterTerm = filterInput ? filterInput.value.toLowerCase().trim() : "";

  if (filterTerm) {
    projects = projects.filter(p => 
      p.title.toLowerCase().includes(filterTerm) ||
      (p.description && p.description.toLowerCase().includes(filterTerm)) ||
      p.skillsNeeded.some(s => s.toLowerCase().includes(filterTerm))
    );
  }

  const feed = document.getElementById("masterProjectFeed"); if (!feed) return;
  if (projects.length === 0) { 
    feed.innerHTML = filterTerm 
      ? "<p style='color:var(--text-muted);'>No projects match your search filter.</p>"
      : "<p style='color:var(--text-muted);'>No project postings available.</p>"; 
  } else {
    feed.innerHTML = projects.map(proj => {
      const remainingSlots = proj.slotsAllocated - (proj.roster.length - 1);
      const isOwner = proj.creatorEmail === user.email;
      const isMember = proj.roster.includes(user.email);
      const applicantObj = proj.applicants.find(a => a.email === user.email);
      const hasApplied = !!applicantObj;
      
      let btn = "";
      if (!isOwner && !isMember && !hasApplied && remainingSlots > 0) {
        btn = `<button class="btn-small btn-req" onclick="applyForProject('${proj._id}')">Request to Join</button>`;
      } else if (hasApplied && !isMember) {
        btn = `<span class="meta-tag">Status: ${applicantObj.decision}</span>`;
      }
      
      let chat = isMember ? `<button class="btn-small btn-chat" onclick="routeToChat('${proj._id}')">💬 Chat</button>` : "";
      let del = isOwner ? `<button class="btn-small btn-del" onclick="deleteProject('${proj._id}')">Remove</button>` : "";
      
      let queue = "";
      if (isOwner && proj.applicants.length > 0) {
        queue = `<div style="margin-top:12px; border-top:1px dashed #cbd5e1; padding-top:8px;">
          <strong style="font-size:13px; color:var(--text-muted);">Applicants:</strong>` + 
          proj.applicants.map(a => `
            <div class="req-item">
              <div>
                <b>${a.name}</b> <span class="branch-badge">${a.branch || 'N/A'}</span> (${a.decision})<br>
                <span style="font-size:12px; color:#4f46e5;">Skills: ${a.skills && a.skills.length ? a.skills.join(", ") : "None listed"}</span>
              </div>
              ${a.decision === 'Pending' ? `<div>
                <button class="btn-acc" onclick="processApplicant('${proj._id}', '${a.email}', 'Accepted')">Accept</button>
                <button class="btn-rej" onclick="processApplicant('${proj._id}', '${a.email}', 'Rejected')">Reject</button>
              </div>` : ""}
            </div>
          `).join("") + `</div>`;
      }

      return `
        <div class="project-card">
          <h3 style="margin:0 0 4px 0;">${proj.title}</h3>
          <div style="font-size:13px; color:var(--text-muted); margin-bottom:8px;">Posted by <b>${proj.creatorName}</b></div>
          <p style="font-size:14px; color:var(--text-main); margin-bottom:12px; line-height:1.4;">${proj.description || "No description provided."}</p>
          <div>${proj.skillsNeeded.map(s => `<span class="meta-tag">${s}</span>`).join("")}</div>
          <div style="font-size:13px; margin-top:6px;">Slots Open: <b>${remainingSlots <= 0 ? "Full" : remainingSlots}</b></div>
          <div class="btn-row">${btn} ${chat} ${del}</div>
          ${queue}
        </div>`;
    }).join("");
  }
  
  const sent = document.getElementById("mySentRequestsFeed");
  const myApps = []; projects.forEach(p => { const f = p.applicants.find(a => a.email === user.email); if (f) myApps.push({t: p.title, s: f.decision}); });
  sent.innerHTML = myApps.length === 0 ? "<p style='color:var(--text-muted); font-size:14px;'>No applications sent.</p>" : myApps.map(a => `<div class="req-item"><span>${a.t}</span><span class="meta-tag">${a.s}</span></div>`).join("");
}

function routeToChat(id) { localStorage.setItem("activeChatRoomId", id); window.location.href = "chat.html"; }

// Workspace Chat
async function initChatRoom() {
  const user = verifySession(); if (!user) return;
  const activeRoomId = localStorage.getItem("activeChatRoomId");
  const res = await fetch(`${API_URL}/projects`); const list = await res.json();
  const room = list.find(p => p._id === activeRoomId);
  if (room) { document.getElementById("roomTitle").innerText = room.title; }
  renderChatMessages(); setInterval(renderChatMessages, 1500);
}

async function renderChatMessages() {
  const user = JSON.parse(localStorage.getItem("currentUser"));
  const id = localStorage.getItem("activeChatRoomId");
  const stream = document.getElementById("chatStream");
  const res = await fetch(`${API_URL}/chat/${id}`); const messages = await res.json();
  
  stream.innerHTML = messages.map(m => `
    <div class="msg-bubble ${m.senderEmail === user.email ? 'me' : 'other'}">
      <div class="sender-name">${m.senderName}</div>
      <div>${m.bodyText}</div>
      <div class="msg-time">${m.timestamp}</div>
    </div>
  `).join("");
  stream.scrollTop = stream.scrollHeight;
}

async function dispatchMessage() {
  const inp = document.getElementById("chatTypedInput"); if (!inp.value.trim()) return;
  const user = JSON.parse(localStorage.getItem("currentUser"));
  await fetch(`${API_URL}/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId: localStorage.getItem("activeChatRoomId"), senderEmail: user.email, senderName: user.name, bodyText: inp.value.trim() })
  });
  inp.value = ""; renderChatMessages();
}

function handleChatEnter(e) { if (e.key === "Enter") dispatchMessage(); }