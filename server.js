const path = require('path');
const fs = require('fs');
const express = require('express');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const app = express();
const port = Number(process.env.PORT) || 3000;
const adminPassword = process.env.ADMIN_PASSWORD || 'GC.ADMIN';
const database = new Database(path.join(__dirname, 'gc-luxury-cars.db'));
const sessions = new Map();
const backupDirectory = path.join(__dirname, 'backups');
fs.mkdirSync(backupDirectory, {recursive:true});

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

database.pragma('journal_mode = WAL');
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS cars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL DEFAULT 2024,
    category TEXT NOT NULL DEFAULT 'Novo cadastro',
    color TEXT NOT NULL DEFAULT '#666',
    price REAL NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    engine_type TEXT NOT NULL DEFAULT 'v8',
    engine TEXT NOT NULL DEFAULT '—',
    power TEXT NOT NULL DEFAULT '—',
    acceleration TEXT NOT NULL DEFAULT '—',
    top_speed TEXT NOT NULL DEFAULT '—',
    consumption TEXT NOT NULL DEFAULT '—',
    tagline TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS car_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
    image_data TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    car_id INTEGER NOT NULL REFERENCES cars(id),
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('pix', 'card')),
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS trade_ins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    target_car_id INTEGER NOT NULL REFERENCES cars(id),
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    estimated_value REAL NOT NULL,
    remaining_amount REAL NOT NULL,
    payment_method TEXT CHECK(payment_method IN ('pix', 'card')),
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS test_drives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    car_id INTEGER NOT NULL REFERENCES cars(id),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function createBackup(){
  const filename = `gc-luxury-cars-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
  database.backup(path.join(backupDirectory, filename));
  const backups = fs.readdirSync(backupDirectory).sort().reverse();
  backups.slice(10).forEach(file => fs.unlinkSync(path.join(backupDirectory, file)));
}
createBackup();
setInterval(createBackup, 24 * 60 * 60 * 1000);

const seedAdmin = database.prepare('SELECT id FROM users WHERE email = ?').get('gcadmin@gmail.com');
if (!seedAdmin) {
  database.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run('GCADMIN', 'gcadmin@gmail.com', bcrypt.hashSync(adminPassword, 12), 'admin');
}
const seedCars = [
  ['BMW','Série 7',2024,'Sedã de Luxo','#1c1e22',1250000,2,'381 cv','bmwserie7_1.jpeg.jpeg','bmwserie7_2.jpeg','bmwserie7_3.jpeg'],
  ['McLaren','720S',2024,'Supercarro','#e8891c',3890000,1,'720 PS / 770 Nm','mclaren720s_1.jpeg','mclaren720s_2.jpeg','mclaren720s_3.jpeg'],
  ['Lamborghini','Aventador',2023,'Supercarro','#5c6b3a',4750000,1,'769 cv','lamborghiniaventadorsvj_1.jpeg','lamborghiniaventadorsvj_2.jpeg'],
  ['Ferrari','296 GTB',2024,'Supercarro Híbrido','#a3231f',4200000,1,'830 cv combinados','ferrari296gtb_1.jpeg','ferrari296gtb_2.jpeg'],
  ['Porsche','911 Carrera GTS',2024,'Esportivo','#8a8f96',1680000,3,'541 cv combinados','porche911carreragts_1.jpeg','porche911carreragts_2.jpeg'],
  ['Porsche','Taycan Turbo S',2024,'Elétrico','#b7c4d1',1590000,2,'761 cv (overboost)','porschetaycanturbos_1.jpeg','porschetaycanturbos_2.jpeg','porschetaycanturbos_3.jpeg'],
  ['Audi','RS e-tron GT',2024,'Elétrico','#2b2f36',1450000,2,'646 cv (com boost)','audirsetrongt_1.jpeg','audirsetrongt_2.jpeg','audirsetrongt_3.jpeg'],
  ['BMW','M4 Competition',2024,'Esportivo','#2f6b46',890000,3,'510 cv / 650 Nm','bm4m4comp_1.jpeg','bm4m4comp_2.jpeg'],
  ['Mercedes-AMG','GT 63',2024,'Grand Tourer','#7d8085',1780000,2,'585 cv','mercedesbensgt63_1.jpeg','mercedesbensgt63_2.jpeg'],
  ['McLaren','Artura',2024,'Supercarro Híbrido','#8fbf3f',3450000,1,'680 cv combinados','mclarenartura_1.jpeg','mclarenartura_2.jpeg'],
  ['Lamborghini','Huracán STO',2023,'Supercarro','#4f9cd6',5200000,1,'640 cv','lamborghinihuracanstoa_1.jpeg','lamborghinihuracanstoa_2.jpeg'],
  ['Ferrari','SF90 Stradale',2024,'Supercarro Híbrido','#c21414',6800000,1,'1.000 cv combinados','ferrarisf90stradale_1.jpeg','ferrarisf90stradale_2.jpeg']
];
if (database.prepare('SELECT COUNT(*) AS count FROM cars').get().count === 0) {
  const insertCar = database.prepare('INSERT INTO cars (brand, model, year, category, color, price, stock, power) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertImage = database.prepare('INSERT INTO car_images (car_id, image_data, sort_order) VALUES (?, ?, ?)');
  database.transaction(() => seedCars.forEach(([brand, model, year, category, color, price, stock, power, ...images]) => {
    const carId = insertCar.run(brand, model, year, category, color, price, stock, power).lastInsertRowid;
    images.forEach((image, index) => insertImage.run(carId, image, index));
  }))();
}

app.use(express.json({limit: '12mb'}));
app.use(express.static(__dirname, {index: 'gc-luxury-cars (1).html'}));

function auth(req, res, next) {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const userId = token && sessions.get(token);
  const user = userId ? database.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(userId) : null;
  if (!user) return res.status(401).json({error: 'Autenticação necessária.'});
  req.user = user;
  next();
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({error: 'Acesso administrativo necessário.'});
  next();
}
function validEmail(email) { return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function createSession(userId) {
  const token = require('crypto').randomBytes(32).toString('hex');
  sessions.set(token, userId);
  setTimeout(() => sessions.delete(token), 8 * 60 * 60 * 1000);
  return token;
}
function carPayload(car) {
  const images = database.prepare('SELECT image_data FROM car_images WHERE car_id = ? ORDER BY sort_order, id').all(car.id).map(item => item.image_data);
  return {...car, images};
}
function getCars() { return database.prepare('SELECT * FROM cars ORDER BY id').all().map(carPayload); }
function logAction(userId, action, entity, entityId, details = {}) { database.prepare('INSERT INTO audit_logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)').run(userId || null, action, entity, entityId || null, JSON.stringify(details)); }

app.get('/api/health', (req, res) => res.json({ok: true, database: 'sqlite'}));
app.get('/api/cars', (req, res) => res.json(getCars()));

app.post('/api/auth/register', (req, res) => {
  const {name, email, password, role = 'user', adminConfirmation} = req.body;
  if (typeof name !== 'string' || !name.trim() || !validEmail(email) || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({error: 'Nome, e-mail válido e senha com pelo menos 6 caracteres são obrigatórios.'});
  }
  if (!['user', 'admin'].includes(role)) return res.status(400).json({error: 'Perfil inválido.'});
  if (role === 'admin' && adminConfirmation !== adminPassword) return res.status(403).json({error: 'Confirmação administrativa inválida.'});
  try {
    const result = database.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(name.trim(), email.trim().toLowerCase(), bcrypt.hashSync(password, 12), role);
    const user = database.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(user);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({error: 'Este e-mail já está cadastrado.'});
    }
    console.error('Falha ao cadastrar usuário:', error);
    res.status(500).json({error: 'Não foi possível criar a conta.'});
  }
});

app.post('/api/auth/login', (req, res) => {
  const {email, password} = req.body;
  const user = database.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) return res.status(401).json({error: 'E-mail ou senha inválidos.'});
  const token = createSession(user.id);
  res.json({id: user.id, name: user.name, email: user.email, role: user.role, token});
});

app.get('/api/me', auth, (req, res) => res.json(req.user));
app.get('/api/me/activity', auth, (req, res) => {
  const orders = database.prepare(`SELECT orders.id, orders.amount, orders.payment_method, orders.status, orders.created_at, cars.brand, cars.model FROM orders JOIN cars ON cars.id = orders.car_id WHERE orders.user_id = ? ORDER BY orders.id DESC`).all(req.user.id);
  const trades = database.prepare(`SELECT trade_ins.id, trade_ins.remaining_amount, trade_ins.payment_method, trade_ins.status, trade_ins.created_at, cars.brand, cars.model FROM trade_ins JOIN cars ON cars.id = trade_ins.target_car_id WHERE trade_ins.user_id = ? ORDER BY trade_ins.id DESC`).all(req.user.id);
  const testDrives = database.prepare(`SELECT test_drives.id, test_drives.date, test_drives.time, test_drives.status, test_drives.created_at, cars.brand, cars.model FROM test_drives JOIN cars ON cars.id = test_drives.car_id WHERE test_drives.user_id = ? ORDER BY test_drives.id DESC`).all(req.user.id);
  res.json({orders, trades, testDrives});
});

app.post('/api/cars', auth, adminOnly, (req, res) => {
  const {brand, model, year = 2024, category = 'Novo cadastro', color = '#666', price = 0, stock = 0, description = '', images = []} = req.body;
  if (!brand || !model || !Number.isFinite(Number(price)) || !Number.isInteger(Number(stock)) || Number(stock) < 0) return res.status(400).json({error: 'Marca, modelo, valor e estoque válidos são obrigatórios.'});
  const insert = database.transaction(() => {
    const result = database.prepare(`INSERT INTO cars (brand, model, year, category, color, price, stock, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(brand.trim(), model.trim(), year, category, color, price, stock, description);
    const addImage = database.prepare('INSERT INTO car_images (car_id, image_data, sort_order) VALUES (?, ?, ?)');
    images.filter(image => typeof image === 'string' && image.startsWith('data:image/')).forEach((image, index) => addImage.run(result.lastInsertRowid, image, index));
    return result.lastInsertRowid;
  })();
  res.status(201).json(carPayload(database.prepare('SELECT * FROM cars WHERE id = ?').get(insert)));
});

app.put('/api/cars/:id', auth, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const car = database.prepare('SELECT * FROM cars WHERE id = ?').get(id);
  if (!car) return res.status(404).json({error: 'Veículo não encontrado.'});
  const price = Number(req.body.price);
  const stock = Number(req.body.stock);
  if (!Number.isFinite(price) || !Number.isInteger(stock) || price < 0 || stock < 0 || typeof req.body.description !== 'string') return res.status(400).json({error: 'Valor, estoque e descrição inválidos.'});
  const fields = {brand:req.body.brand, model:req.body.model, year:req.body.year, category:req.body.category, color:req.body.color, price, stock, description:req.body.description.trim(), engine_type:req.body.engine_type, engine:req.body.engine, power:req.body.power, acceleration:req.body.acceleration, top_speed:req.body.top_speed, consumption:req.body.consumption, tagline:req.body.tagline};
  if(!fields.brand || !fields.model) return res.status(400).json({error:'Marca e modelo são obrigatórios.'});
  database.prepare(`UPDATE cars SET brand = ?, model = ?, year = ?, category = ?, color = ?, price = ?, stock = ?, description = ?, engine_type = ?, engine = ?, power = ?, acceleration = ?, top_speed = ?, consumption = ?, tagline = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(fields.brand.trim(), fields.model.trim(), fields.year, fields.category, fields.color, fields.price, fields.stock, fields.description, fields.engine_type, fields.engine, fields.power, fields.acceleration, fields.top_speed, fields.consumption, fields.tagline, id);
  logAction(req.user.id, 'update', 'car', id, fields);
  res.json(carPayload(database.prepare('SELECT * FROM cars WHERE id = ?').get(id)));
});

app.post('/api/orders', auth, (req, res) => {
  const {carId, amount, paymentMethod} = req.body;
  if (!Number.isInteger(Number(carId)) || !Number.isFinite(Number(amount)) || Number(amount) < 0 || !['pix', 'card'].includes(paymentMethod)) return res.status(400).json({error: 'Dados do pedido inválidos.'});
  const result = database.prepare('INSERT INTO orders (user_id, car_id, amount, payment_method) VALUES (?, ?, ?, ?)').run(req.user.id, carId, amount, paymentMethod);
  logAction(req.user.id, 'create', 'order', result.lastInsertRowid, {carId, amount, paymentMethod});
  res.status(201).json({id: result.lastInsertRowid, status: 'pending'});
});

app.post('/api/trade-ins', auth, (req, res) => {
  const {targetCarId, customerName, phone, email, estimatedValue, remainingAmount, paymentMethod} = req.body;
  if (!customerName || String(phone).replace(/\D/g, '').length < 10 || !validEmail(email) || !['pix', 'card'].includes(paymentMethod)) return res.status(400).json({error: 'Dados da troca ou pagamento inválidos.'});
  const result = database.prepare(`INSERT INTO trade_ins (user_id, target_car_id, customer_name, phone, email, estimated_value, remaining_amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(req.user.id, targetCarId, customerName.trim(), phone, email.trim().toLowerCase(), estimatedValue, remainingAmount, paymentMethod);
  logAction(req.user.id, 'create', 'trade_in', result.lastInsertRowid, {targetCarId, remainingAmount, paymentMethod});
  res.status(201).json({id: result.lastInsertRowid, status: 'pending'});
});

app.post('/api/test-drives', (req, res) => {
  const {carId, name, email, date, time} = req.body;
  if (!carId || !name || !validEmail(email) || !date || !time) return res.status(400).json({error: 'Dados do agendamento inválidos.'});
  const userId = Number(req.header('x-user-id')) || null;
  const result = database.prepare('INSERT INTO test_drives (user_id, car_id, name, email, date, time) VALUES (?, ?, ?, ?, ?, ?)').run(userId, carId, name.trim(), email.trim().toLowerCase(), date, time);
  logAction(userId, 'create', 'test_drive', result.lastInsertRowid, {carId, date, time});
  res.status(201).json({id: result.lastInsertRowid, status: 'scheduled'});
});

app.get('/api/admin/summary', auth, adminOnly, (req, res) => {
  const cars = database.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(stock), 0) AS stock, COALESCE(SUM(price * stock), 0) AS value FROM cars').get();
  const orders = database.prepare('SELECT COUNT(*) AS count FROM orders').get();
  const trades = database.prepare('SELECT COUNT(*) AS count FROM trade_ins').get();
  const testDrives = database.prepare('SELECT COUNT(*) AS count FROM test_drives').get();
  res.json({cars, orders: orders.count, trades: trades.count, testDrives: testDrives.count});
});

app.get('/api/admin/records', auth, adminOnly, (req, res) => {
  res.json({
    orders: database.prepare(`SELECT orders.*, users.name AS customer_name, cars.brand, cars.model FROM orders LEFT JOIN users ON users.id = orders.user_id JOIN cars ON cars.id = orders.car_id ORDER BY orders.id DESC`).all(),
    trades: database.prepare(`SELECT trade_ins.*, cars.brand, cars.model FROM trade_ins JOIN cars ON cars.id = trade_ins.target_car_id ORDER BY trade_ins.id DESC`).all(),
    testDrives: database.prepare(`SELECT test_drives.*, cars.brand, cars.model FROM test_drives JOIN cars ON cars.id = test_drives.car_id ORDER BY test_drives.id DESC`).all(),
    history: database.prepare(`SELECT audit_logs.*, users.name AS user_name FROM audit_logs LEFT JOIN users ON users.id = audit_logs.user_id ORDER BY audit_logs.id DESC LIMIT 100`).all()
  });
});

app.patch('/api/admin/records/:type/:id', auth, adminOnly, (req, res) => {
  const tables = {orders:'orders', trades:'trade_ins', testDrives:'test_drives'};
  const table = tables[req.params.type];
  if (!table || !['pending','approved','rejected','scheduled','completed'].includes(req.body.status)) return res.status(400).json({error:'Status inválido.'});
  const id = Number(req.params.id);
  const result = database.prepare(`UPDATE ${table} SET status = ? WHERE id = ?`).run(req.body.status, id);
  if (!result.changes) return res.status(404).json({error:'Registro não encontrado.'});
  logAction(req.user.id, 'status', table, id, {status:req.body.status});
  res.json({id, status:req.body.status});
});

app.listen(port, () => console.log(`GC Luxury Cars rodando em http://localhost:${port}`));
