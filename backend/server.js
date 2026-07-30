require('node:dns/promises').setServers(["1.1.1.1", "8.8.8.8"]);
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ==================== 1. DATABASE CONNECTION ====================
mongoose.connect(process.env.MONGO_URI)
  .then(() => { 
    console.log("🚀 MongoDB connected successfully."); 
    seedData(); 
  })
  .catch(err => console.log("❌ MongoDB Connection Error:", err));

// ==================== 2. DATABASE MODELS ====================
const Student = mongoose.model('Student', new mongoose.Schema({
  name: String, 
  college: String, 
  branch: String, 
  bio: String, 
  skills: [String], 
  email: { type: String, unique: true }, 
  password: { type: String, required: true }
}));

const Project = mongoose.model('Project', new mongoose.Schema({
  title: String, 
  description: String, 
  skillsNeeded: [String], 
  slotsAllocated: Number, 
  creatorEmail: String, 
  creatorName: String, 
  roster: [String],
  applicants: [{ 
    email: String, 
    name: String, 
    branch: String,
    skills: [String], 
    decision: { type: String, default: 'Pending' } 
  }]
}));

const ChatLog = mongoose.model('ChatLog', new mongoose.Schema({
  projectId: String, 
  senderEmail: String, 
  senderName: String, 
  bodyText: String, 
  timestamp: String
}));

// ==================== 3. AUTOMATIC DATA SEEDER ====================
async function seedData() {
  if (await Student.countDocuments() === 0) {
    const hashed = await bcrypt.hash("123", 10);
    await Student.insertMany([
      { name: "Amit Sharma", college: "ABC Tech", branch: "Computer Science", bio: "Full stack enthusiast building web apps.", skills: ["HTML", "React", "JavaScript"], email: "amit@gmail.com", password: hashed },
      { name: "Rahul Verma", college: "XYZ Uni", branch: "Information Technology", bio: "Passionate about backend & cloud architectures.", skills: ["Node.js", "MongoDB", "Python"], email: "rahul@gmail.com", password: hashed }
    ]);
    console.log("🌱 Seed users added to cloud database.");
  }
}

// ==================== 4. API ENDPOINTS ====================

// --- Authentication (Login & Sign-Up) ---
app.post('/api/register', async (req, res) => {
  const { name, email, password, college, branch, skills } = req.body;
  try {
    const existing = await Student.findOne({ email });
    if (existing) return res.status(400).json({ error: "An account with this email already exists." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const parsedSkills = skills ? skills.split(",").map(s => s.trim()).filter(Boolean) : [];

    const newStudent = new Student({
      name,
      email,
      password: hashedPassword,
      college: college || "N/A",
      branch: branch || "N/A",
      skills: parsedSkills,
      bio: ""
    });

    await newStudent.save();
    const { password: _, ...user } = newStudent.toObject();
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Account creation failed. Please try again." });
  }
});

app.post('/api/login', async (req, res) => {
  const st = await Student.findOne({ email: req.body.email });
  if (st && await bcrypt.compare(req.body.password, st.password)) {
    const { password, ...user } = st.toObject(); 
    return res.json(user);
  }
  res.status(400).json({ error: "Invalid credentials." });
});

app.put('/api/students/profile', async (req, res) => {
  const { email, skills, college, branch, bio } = req.body;
  try {
    const updatedUser = await Student.findOneAndUpdate(
      { email },
      { skills, college, branch, bio },
      { new: true }
    ).select('-password');
    
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: "Could not update profile." });
  }
});

// --- Search Candidates ---
app.get('/api/students/search', async (req, res) => {
  const skillQuery = req.query.skill || "";
  try {
    const matches = await Student.find({
      skills: { $regex: skillQuery, $options: 'i' }
    }).select('-password');
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: "Search failed." });
  }
});

// --- Project Operations ---
app.get('/api/projects', async (req, res) => { 
  res.json(await Project.find()); 
});

app.post('/api/projects', async (req, res) => {
  const p = new Project({ ...req.body, roster: [req.body.creatorEmail], applicants: [] });
  await p.save(); 
  res.json(p);
});

app.delete('/api/projects/:id', async (req, res) => { 
  await Project.findByIdAndDelete(req.params.id); 
  res.json({ success: true }); 
});

// --- Applications ---
app.post('/api/projects/:id/apply', async (req, res) => {
  const p = await Project.findById(req.params.id);
  const applicantUser = await Student.findOne({ email: req.body.email });

  if (p.applicants.some(a => a.email === req.body.email)) {
    return res.status(400).json({ error: "Already applied!" });
  }

  p.applicants.push({ 
    email: req.body.email, 
    name: req.body.name, 
    branch: applicantUser ? applicantUser.branch : "N/A",
    skills: applicantUser ? applicantUser.skills : [], 
    decision: "Pending" 
  }); 
  
  await p.save(); 
  res.json(p);
});

app.post('/api/projects/:id/process', async (req, res) => {
  const p = await Project.findById(req.params.id);
  const a = p.applicants.find(x => x.email === req.body.applicantEmail);
  if (a) {
    a.decision = req.body.outcome;
    if (req.body.outcome === "Accepted" && !p.roster.includes(req.body.applicantEmail)) {
      p.roster.push(req.body.applicantEmail);
    }
    await p.save(); 
  }
  res.json(p);
});

// --- Chat Log ---
app.get('/api/chat/:projectId', async (req, res) => { 
  res.json(await ChatLog.find({ projectId: req.params.projectId })); 
});

app.post('/api/chat', async (req, res) => {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const log = new ChatLog({ ...req.body, timestamp: time }); 
  await log.save(); 
  res.json(log);
});

app.listen(5000, () => console.log("📡 Server active on port: http://localhost:5000"));