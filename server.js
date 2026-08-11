/* ==========================================================================
   💍 简婚记 - 云端 Node.js + 持久化数据库服务端 (server.js)
   功能：提供静态网页服务、用户注册登录、7天自动免登录 Token 鉴权与多端云数据库
   ========================================================================== */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3535;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'wedding_planner_db.json');

// Session duration: 7 Days (7 * 24 * 60 * 60 * 1000 ms)
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default state generator
function getDefaultData(username) {
  const defaultDate = new Date();
  defaultDate.setMonth(defaultDate.getMonth() + 6);
  defaultDate.setHours(10, 58, 0, 0);

  return {
    settings: {
      couples: username ? `${username} ❤️ 伴侣` : '新郎 ❤️ 新娘',
      date: defaultDate.toISOString().slice(0, 16),
      location: '三亚海棠湾亚特兰蒂斯酒店',
      quote: '爱是执子之手，与子偕老。',
      totalBudget: 200000
    },
    checklist: [
      { id: 'c1', title: '确定婚期吉日与婚礼形式', category: '酒店婚宴', completed: false, notes: '挑选黄金吉日' },
      { id: 'c2', title: '预订婚宴酒店宴会厅', category: '酒店婚宴', completed: false, notes: '确定桌数与菜单套餐' },
      { id: 'c3', title: '预订婚纱摄影机构拍摄外景', category: '婚纱礼服与美妆', completed: false, notes: '选择摄影师与拍摄风格' },
      { id: 'c4', title: '确定婚礼策划团队与四大金刚', category: '婚庆策划与四大', completed: false, notes: '主持人、摄影师、摄像师、新娘跟妆师' },
      { id: 'c5', title: '选购对戒与新娘钻戒', category: '珠宝首饰', completed: false, notes: '定制刻字婚戒' },
      { id: 'c6', title: '定制新郎西装与新娘婚纱礼服', category: '婚纱礼服与美妆', completed: false, notes: '出门纱、主婚纱、敬酒服' },
      { id: 'c7', title: '选购喜糖、喜饼及伴手礼礼盒', category: '伴手礼与喜糖', completed: false, notes: '准备300份' },
      { id: 'c8', title: '新房软装布置与贴喜字', category: '婚房布置与采购', completed: false, notes: '红气球、压床娃娃、铺红床单' },
      { id: 'c9', title: '核对结婚戒指、急救包及誓言卡', category: '其他事项', completed: false, notes: '伴郎保管戒指，伴娘随身携带急救包' }
    ],
    expenses: [
      { id: 'e1', title: '婚宴酒店定金', category: '酒店婚宴', amount: 20000, status: 'deposit', deposit: 20000, notes: '尾款在婚礼一周前付清' },
      { id: 'e2', title: '婚纱照全款', category: '婚纱礼服', amount: 12000, status: 'paid', deposit: 12000, notes: '已取产品相册' },
      { id: 'e3', title: '定制钻戒与结婚对戒', category: '珠宝首饰', amount: 25000, status: 'paid', deposit: 25000, notes: '已到货取回' },
      { id: 'e4', title: '婚礼策划预付款', category: '婚庆策划', amount: 10000, status: 'deposit', deposit: 10000, notes: '总设计费3.5万元' }
    ],
    gifts: [
      { id: 'g1', type: 'recv', name: '张叔叔', relation: '男方亲戚', amount: 5000, date: '2026-07-20', returnStatus: 'none', notes: '男方大舅贺礼' },
      { id: 'g2', type: 'recv', name: '李阿姨', relation: '女方亲戚', amount: 6600, date: '2026-07-21', returnStatus: 'none', notes: '女方小姨贺礼' },
      { id: 'g3', type: 'recv', name: '王强', relation: '同学朋友', amount: 1000, date: '2026-07-25', returnStatus: 'none', notes: '伴郎红包' },
      { id: 'g4', type: 'recv', name: '陈主管', relation: '男方同事', amount: 1200, date: '2026-07-28', returnStatus: 'none', notes: '部门领导祝福' }
    ]
  };
}

// Read database
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    return { users: {}, tokens: {}, userData: {}, globalData: getDefaultData() };
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: parsed.users || {},
      tokens: parsed.tokens || {},
      userData: parsed.userData || {},
      globalData: parsed.globalData || parsed.checklist ? parsed : getDefaultData()
    };
  } catch (err) {
    console.error('⚠️ Read DB Error:', err);
    return { users: {}, tokens: {}, userData: {}, globalData: getDefaultData() };
  }
}

// Write database atomically
function writeDB(db) {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
    return true;
  } catch (err) {
    console.error('⚠️ Write DB Error:', err);
    return false;
  }
}

// Simple password hashing
function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

// Token Verification Middleware
function authenticate(req) {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) return null;

  const db = readDB();
  const session = db.tokens[token];
  if (!session) return null;

  const expTime = Number(session.expiresAt);
  if (isNaN(expTime) || Date.now() > expTime) {
    delete db.tokens[token];
    writeDB(db);
    return null;
  }

  return session.username;
}

// REST API Endpoints

// 1. Register Endpoint
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || username.trim().length < 2 || password.length < 4) {
    return res.status(400).json({ success: false, message: '账号至少2位，密码至少4位' });
  }

  const uName = username.trim();
  const db = readDB();
  // If user exists, verify password
  if (db.users[uName]) {
    if (db.users[uName].passwordHash !== hashPassword(password)) {
      return res.status(400).json({ success: false, message: '该账号已被注册，请输入正确密码或直接登录' });
    }
  } else {
    // Create new User
    db.users[uName] = {
      username: uName,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // Ensure User Data exists (preserve existing user data if already created!)
  if (!db.userData[uName]) {
    db.userData[uName] = getDefaultData(uName);
  }

  // Generate 7-day Token
  const token = 'tok_' + crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + SEVEN_DAYS_MS;
  db.tokens[token] = { username: uName, expiresAt };

  writeDB(db);

  res.json({
    success: true,
    message: '注册成功！已为您开启7天免登录',
    token,
    expiresAt,
    username: uName,
    data: db.userData[uName]
  });
});

// 2. Login Endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '请输入用户名和密码' });
  }

  const uName = username.trim();
  const db = readDB();
  const user = db.users[uName];

  if (!user) {
    return res.status(404).json({ success: false, message: '账号不存在，请先切到【注册新账号】' });
  }

  if (user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ success: false, message: '密码不正确，请重新输入' });
  }

  // Ensure User Data exists
  if (!db.userData[uName]) {
    db.userData[uName] = getDefaultData(uName);
  }

  // Generate 7-day Token
  const token = 'tok_' + crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + SEVEN_DAYS_MS;
  db.tokens[token] = { username: uName, expiresAt };

  writeDB(db);

  res.json({
    success: true,
    message: '登录成功！已自动保持登录状态 7 天',
    token,
    expiresAt,
    username: uName,
    data: db.userData[uName]
  });
});

// 3. Verify Session Endpoint (/api/me)
app.get('/api/me', (req, res) => {
  const uName = authenticate(req);
  if (!uName) {
    return res.status(401).json({ success: false, message: '未登录或登录状态已过期，请重新登录' });
  }

  const db = readDB();
  const data = db.userData[uName] || getDefaultData(uName);

  res.json({
    success: true,
    username: uName,
    data: data
  });
});

// 4. Logout Endpoint
app.post('/api/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (token) {
    const db = readDB();
    if (db.tokens[token]) {
      delete db.tokens[token];
      writeDB(db);
    }
  }

  res.json({ success: true, message: '已安全退出登录' });
});

// 5. Get current cloud database state (Authenticated or Fallback)
app.get('/api/data', (req, res) => {
  const uName = authenticate(req);
  const db = readDB();

  if (uName && db.userData[uName]) {
    return res.json({ success: true, username: uName, data: db.userData[uName] });
  }

  res.json({ success: true, isGlobalFallback: true, data: db.globalData });
});

// 6. Save state to cloud database (Authenticated or Fallback)
app.post('/api/data', (req, res) => {
  const newState = req.body;
  if (!newState || typeof newState !== 'object') {
    return res.status(400).json({ success: false, message: '数据格式无效' });
  }

  const uName = authenticate(req);
  const db = readDB();

  if (uName) {
    db.userData[uName] = newState;
  } else {
    db.globalData = newState;
  }

  const ok = writeDB(db);
  if (ok) {
    res.json({ success: true, message: '成功同步至云端数据库' });
  } else {
    res.status(500).json({ success: false, message: '云端数据库写入失败' });
  }
});

// 7. Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Fallback to index.html for SPA single page routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`💍 简婚记 (Sweet Wedding Planner) 云端服务已成功启动！`);
  console.log(`🌐 访问地址: http://localhost:${PORT}`);
  console.log(`📁 数据库文件路径: ${DB_FILE}`);
  console.log(`==================================================\n`);
});
