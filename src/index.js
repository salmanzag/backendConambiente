// -----------------------------
// Load environment variables
// -----------------------------
require('dotenv').config();

// -----------------------------
// Imports
// -----------------------------
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const fs = require('fs');


// -----------------------------
// Mongoose Events
// -----------------------------

mongoose.connection.on('connected', () => {
  console.log('Mongoose: conexión establecida');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose: error de conexión', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose: conexión perdida');
});


// -----------------------------
// App & Constants
// -----------------------------
const app = express();
const PORT = process.env.PORT || 3000;

// Seguridad 
const JWT_SECRET = process.env.JWT_SECRET;

// Mongo
const MONGO_URI = process.env.MONGO_URI;

// Mail 
const MAIL_USER = process.env.MAIL_USER;
const MAIL_PASS = process.env.MAIL_PASS;

//dominio final
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;


//Correos destinatarios
const MAIL_TO_CONTACT = process.env.MAIL_TO_CONTACT_WITH_US || MAIL_USER; //Contacto general
const MAIL_TO_PQR = process.env.MAIL_TO_PQR || MAIL_USER; //PQR
const MAIL_TO_WORK = process.env.MAIL_TO_WORK_WITH_US || MAIL_USER; //Trabaja con nosotros

// Validación básica de config en arranque
if (!MAIL_USER || !MAIL_PASS) {
  console.warn('MAIL_USER o MAIL_PASS no están configurados. El envío de correos fallará.');
}

// Uploads
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// -----------------------------
// Middlewares globales
// -----------------------------
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:4200')
  .split(',')
  .map(s => s.trim());

  
app.use(cors()); // Esto permite peticiones desde cualquier lugar


app.use(express.json());

// Servir uploads
app.use('/uploads', express.static(UPLOADS_DIR));

// -----------------------------
// Multer config (imágenes)
// -----------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${unique}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Tipos permitidos
  const allowedImageTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg'
  ];

  const allowedCvTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  // Si es el campo de CV (trabaja con nosotros)
  if (file.fieldname === 'cv') {
    if (allowedCvTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error('Formato de CV no permitido (solo PDF o Word)'), false);
  }

  // Para el resto (imagenes de noticias/proyectos)
  if (allowedImageTypes.includes(file.mimetype)) {
    return cb(null, true);
  }

  return cb(new Error('Formato de imagen no permitido'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB para CV
});

// -----------------------------
// DB Models
// -----------------------------
const Noticia = require('./models/Noticias.model');
const Proyecto = require('./models/Proyecto.model');
const Suscriptor = require('./models/Suscriptor.model');

// -----------------------------
// Mongo Connection
// -----------------------------
async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB conectado correctamente');

    app.listen(PORT, () => {
      console.log(`Backend escuchando en http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('Error conectando MongoDB ', err);
    process.exit(1);
  }
}

startServer();

// -----------------------------
// Nodemailer
// -----------------------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.conambiente.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  auth: { user: MAIL_USER, pass: MAIL_PASS },
  tls: {
    rejectUnauthorized: false
  }
});


transporter.verify()
  .then(() => console.log('Servidor de correo listo para enviar mensajes'))
  .catch(err => console.error('Error configurando el correo:', err));


// -----------------------------
// Admin user de prueba
// -----------------------------
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Faltan variables de entorno ADMIN_EMAIL o ADMIN_PASSWORD');
  console.warn('ADMIN_EMAIL o ADMIN_PASSWORD no configurados. Login admin deshabilitado.');
  process.exit(1);
}

const adminUser = {
  id: 'admin1',
  email: ADMIN_EMAIL,
  passwordHash: bcrypt.hashSync(ADMIN_PASSWORD, 10)
};



// -----------------------------
// Auth Middleware
// -----------------------------
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No autorizado: falta token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

// -----------------------------
// Helper: Boletín
// -----------------------------
async function enviarBoletinNuevaNoticia(noticia) {
  const activos = await Suscriptor.find({ activo: true });
  if (!activos.length) return;

  const subject = `Nueva noticia: ${noticia.titulo}`;

  const html = `
    <h2>${noticia.titulo}</h2>
    <p>${noticia.resumen}</p>
    <p><strong>Fecha:</strong> ${noticia.fecha}</p>
    ${noticia.imagenUrl
      ? `<img src="${PUBLIC_BASE_URL}${noticia.imagenUrl}" style="max-width:600px;width:100%;"/>`
      : ''
    }
    <p>Puedes ver más detalles en el sitio web.</p>
    <hr>
    <p style="font-size:12px;color:#666;">
      Si no deseas recibir más correos, puedes solicitar la desuscripción.
    </p>
  `;

  for (const s of activos) {
    await transporter.sendMail({
      from: `"Conambiente" <${MAIL_USER}>`,
      to: s.email,
      subject,
      html
    });
  }
}

// -----------------------------
// Rutas base
// -----------------------------
app.get('/', (req, res) => {
  res.send('API de Conambiente funcionando');
});

// -----------------------------
// Auth Routes
// -----------------------------
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  // Usamos directamente las variables de entorno para asegurar que lean el valor actual de Render
  const envEmail = process.env.ADMIN_EMAIL;
  const envPassword = process.env.ADMIN_PASSWORD;

  if (email !== envEmail || password !== envPassword) {
    console.log('Credenciales no coinciden');
    return res.status(401).json({ message: 'Credenciales inválidas' });
  }

  // Si coinciden, generas el token
  const token = jwt.sign(
    { userId: 'admin1', email: envEmail, role: 'admin' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  res.json({
    token,
    user: { email: envEmail, role: 'admin' }
  });
});

// -----------------------------
// Noticias Routes (Mongo)
// -----------------------------
app.get('/api/noticias', async (req, res) => {
  try {
    const noticias = await Noticia.find().sort({ createdAt: -1 });
    res.json(noticias);
  } catch (err) {
    res.status(500).json({ message: 'Error obteniendo noticias' });
  }
});

app.get('/api/noticias/:id', async (req, res) => {
  try {
    const noticia = await Noticia.findById(req.params.id);
    if (!noticia) return res.status(404).json({ message: 'Noticia no encontrada' });
    res.json(noticia);
  } catch (err) {
    res.status(500).json({ message: 'Error obteniendo noticia' });
  }
});

app.post('/api/noticias', authMiddleware, upload.single('imagen'), async (req, res) => {
  try {
    const data = req.body;

    if (!data.titulo || !data.resumen || !data.contenido || !data.fecha) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }

    const imagenUrl = req.file ? `/uploads/${req.file.filename}` : (data.imagenUrl || '');

    const nueva = await Noticia.create({
      titulo: data.titulo,
      resumen: data.resumen,
      contenido: data.contenido,
      fecha: data.fecha,
      imagenUrl,
      categoria: data.categoria || ''
    });

    // Enviar boletín sin bloquear respuesta
    enviarBoletinNuevaNoticia(nueva).catch(console.error);

    res.status(201).json(nueva);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creando noticia' });
  }
});

app.put('/api/noticias/:id', authMiddleware, upload.single('imagen'), async (req, res) => {
  try {
    console.log('PUT /api/noticias/:id ->', req.params.id);

    const data = req.body;

    const noticia = await Noticia.findById(req.params.id);
    if (!noticia) {
      console.log('Noticia no encontrada con id', req.params.id);
      return res.status(404).json({ message: 'Noticia no encontrada' });
    }

    const imagenUrl = req.file ? `/uploads/${req.file.filename}` : (data.imagenUrl ?? noticia.imagenUrl);

    noticia.titulo = data.titulo ?? noticia.titulo;
    noticia.resumen = data.resumen ?? noticia.resumen;
    noticia.contenido = data.contenido ?? noticia.contenido;
    noticia.fecha = data.fecha ?? noticia.fecha;
    noticia.categoria = data.categoria ?? noticia.categoria;
    noticia.imagenUrl = imagenUrl;

    await noticia.save();
    console.log('Noticia actualizada OK', noticia.id);
    res.json(noticia);
  } catch (err) {
    console.error('Error en PUT /api/noticias/:id', err);
    res.status(500).json({ message: 'Error actualizando noticia' });
  }
});

app.delete('/api/noticias/:id', authMiddleware, async (req, res) => {
  try {
    console.log('DELETE /api/noticias/:id ->', req.params.id);
    const deleted = await Noticia.findByIdAndDelete(req.params.id);
    if (!deleted) {
      console.log('Noticia no encontrada para eliminar', req.params.id);
      return res.status(404).json({ message: 'Noticia no encontrada' });
    }
    console.log('Noticia eliminada OK', deleted.id);
    res.status(204).send();
  } catch (err) {
    console.error('Error en DELETE /api/noticias/:id', err);
    res.status(500).json({ message: 'Error eliminando noticia' });
  }
});


// -----------------------------
// Proyectos Routes (Mongo)
// -----------------------------
app.get('/api/proyectos', async (req, res) => {
  try {
    const proyectos = await Proyecto.find().sort({ createdAt: -1 });
    res.json(proyectos);
  } catch (err) {
    res.status(500).json({ message: 'Error obteniendo proyectos' });
  }
});

app.get('/api/proyectos/:id', async (req, res) => {
  try {
    const proyecto = await Proyecto.findById(req.params.id);
    if (!proyecto) return res.status(404).json({ message: 'Proyecto no encontrado' });
    res.json(proyecto);
  } catch (err) {
    res.status(500).json({ message: 'Error obteniendo proyecto' });
  }
});

app.get('/api/proyectos/departamento/:departamento', async (req, res) => {
  try {
    const departamento = decodeURIComponent(req.params.departamento);
    const proyectos = await Proyecto.find({ departamento }).sort({ createdAt: -1 });
    res.json(proyectos);
  } catch (err) {
    res.status(500).json({ message: 'Error filtrando proyectos' });
  }
});

app.post('/api/proyectos', authMiddleware, upload.single('imagen'), async (req, res) => {
  try {
    const data = req.body;

    if (!data.nombre || !data.descripcion || !data.departamento) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }

    const imagenUrl = req.file ? `/uploads/${req.file.filename}` : (data.imagenUrl || '');

    const nuevo = await Proyecto.create({
      nombre: data.nombre,
      descripcion: data.descripcion,
      departamento: data.departamento,
      municipio: data.municipio || '',
      estado: data.estado || 'En ejecución',
      fechaInicio: data.fechaInicio || null,
      fechaFin: data.fechaFin || null,
      coordenadas: data.coordenadas || null,
      imagenUrl
    });

    res.status(201).json(nuevo);
  } catch (err) {
    res.status(500).json({ message: 'Error creando proyecto' });
  }
});

app.put('/api/proyectos/:id', authMiddleware, upload.single('imagen'), async (req, res) => {
  try {
    const data = req.body;

    const proyecto = await Proyecto.findById(req.params.id);
    if (!proyecto) return res.status(404).json({ message: 'Proyecto no encontrado' });

    const imagenUrl = req.file ? `/uploads/${req.file.filename}` : (data.imagenUrl ?? proyecto.imagenUrl);

    proyecto.nombre = data.nombre ?? proyecto.nombre;
    proyecto.estado = data.estado ?? proyecto.estado;
    proyecto.descripcion = data.descripcion ?? proyecto.descripcion;
    proyecto.departamento = data.departamento ?? proyecto.departamento;
    proyecto.municipio = data.municipio ?? proyecto.municipio;
    proyecto.fechaInicio = data.fechaInicio ?? proyecto.fechaInicio;
    proyecto.fechaFin = data.fechaFin ?? proyecto.fechaFin;
    proyecto.coordenadas = data.coordenadas ?? proyecto.coordenadas;
    proyecto.imagenUrl = imagenUrl;

    await proyecto.save();
    res.json(proyecto);
  } catch (err) {
    res.status(500).json({ message: 'Error actualizando proyecto' });
  }
});

app.delete('/api/proyectos/:id', authMiddleware, async (req, res) => {
  try {
    const deleted = await Proyecto.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Proyecto no encontrado' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Error eliminando proyecto' });
  }
});

// -----------------------------
// Boletín Routes
// -----------------------------
app.post('/api/boletin/suscribir', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email requerido' });

    const existing = await Suscriptor.findOne({ email });

    if (existing) {
      if (!existing.activo) {
        existing.activo = true;
        await existing.save();
      }
      return res.json({ ok: true, message: 'Ya estabas suscrito.' });
    }

    await Suscriptor.create({ email, activo: true });
    res.json({ ok: true, message: 'Suscripción exitosa.' });
  } catch (err) {
    res.status(500).json({ message: 'Error suscribiendo email' });
  }
});

app.post('/api/boletin/desuscribir', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email requerido' });

    const existing = await Suscriptor.findOne({ email });
    if (!existing) return res.json({ ok: true, message: 'No estabas suscrito.' });

    existing.activo = false;
    await existing.save();

    res.json({ ok: true, message: 'Te has desuscrito correctamente.' });
  } catch (err) {
    res.status(500).json({ message: 'Error desuscribiendo email' });
  }
});

// -----------------------------
// Formularios: Contacto
// -----------------------------
app.post('/api/contacto', async (req, res) => {
  const { nombre, email, telefono, asunto, mensaje } = req.body;

  if (!nombre || !email || !mensaje) {
    return res.status(400).json({ message: 'Faltan campos obligatorios (nombre, email, mensaje)' });
  }

  const destinatario = MAIL_TO_CONTACT;

  const mailOptions = {
    from: `"Web Conambiente" <${MAIL_USER}>`,
    to: destinatario,
    subject: `Contacto web: ${asunto || 'Sin asunto'}`,
    text: `
Nuevo mensaje desde el formulario de contacto:

Nombre: ${nombre}
Email: ${email}
Teléfono: ${telefono || 'No proporcionado'}

Mensaje:
${mensaje}
    `,
    html: `
      <h3>Nuevo mensaje desde el formulario de contacto</h3>
      <p><strong>Nombre:</strong> ${nombre}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Teléfono:</strong> ${telefono || 'No proporcionado'}</p>
      <p><strong>Asunto:</strong> ${asunto || 'Sin asunto'}</p>
      <p><strong>Mensaje:</strong></p>
      <p>${String(mensaje).replace(/\n/g, '<br>')}</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ ok: true, message: 'Mensaje enviado correctamente.' });
  } catch (err) {
    console.error('Error enviando correo de contacto:', err);
    res.status(500).json({ ok: false, message: 'Error al enviar el mensaje.' });
  }
});

// -----------------------------
// Formularios: PQR
// -----------------------------
app.post('/api/pqr', async (req, res) => {
  const {
    nombreCompleto,
    email,
    telefono,
    tipo,
    asunto,
    mensaje,
    aceptaTratamientoDatos
  } = req.body;

  if (!nombreCompleto || !email || !mensaje || !tipo) {
    return res.status(400).json({ message: 'Faltan campos obligatorios (nombreCompleto, email, tipo, mensaje)' });
  }

  if (!aceptaTratamientoDatos) {
    return res.status(400).json({ message: 'Debes aceptar el tratamiento de datos.' });
  }

  const destinatario = MAIL_TO_PQR;

  const mailOptions = {
    from: `"PQR Web Conambiente" <${MAIL_USER}>`,
    to: destinatario,
    subject: `Nueva ${tipo} recibida desde PQR: ${asunto || 'Sin asunto'}`,
    text: `Nueva PQR desde el sitio web:

Tipo: ${tipo}
Nombre: ${nombreCompleto}
Email: ${email}
Teléfono: ${telefono || 'No proporcionado'}

Asunto: ${asunto || 'Sin asunto'}

Mensaje:
${mensaje}
    `,
    html: `
      <h3>Nueva ${tipo} desde el formulario PQR</h3>
      <p><strong>Tipo:</strong> ${tipo}</p>
      <p><strong>Nombre:</strong> ${nombreCompleto}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Teléfono:</strong> ${telefono || 'No proporcionado'}</p>
      <p><strong>Asunto:</strong> ${asunto || 'Sin asunto'}</p>
      <p><strong>Mensaje:</strong></p>
      <p>${String(mensaje).replace(/\n/g, '<br>')}</p>
      <hr>
      <p>El usuario <strong>${aceptaTratamientoDatos ? 'ACEPTÓ' : 'NO ACEPTÓ'}</strong> el tratamiento de datos.</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ ok: true, message: 'PQR enviada correctamente.' });
  } catch (err) {
    console.error('Error enviando correo de PQR:', err);
    res.status(500).json({ ok: false, message: 'Error al enviar la PQR.' });
  }
});



// -----------------------------
// Formulario: Trabaja con nosotros
// -----------------------------
app.post('/api/trabaja-nosotros', upload.single('cv'), async (req, res) => {
  try {
    const {
      nombreCompleto,
      email,
      telefono,
      cargo,
      profesion,
      mensaje
    } = req.body;

    // Validaciones básicas
    if (!nombreCompleto || !email || !cargo || !profesion) {
      return res.status(400).json({
        message: 'Faltan campos obligatorios (nombreCompleto, email, cargo, profesion)'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: 'Debes adjuntar tu hoja de vida (CV).'
      });
    }

    const destinatario = MAIL_TO_WORK;

    const mailOptions = {
      from: `"Trabaja con nosotros - Conambiente" <${MAIL_USER}>`,
      to: destinatario,
      subject: `Nuevo candidato: ${nombreCompleto} - Cargo: ${cargo}`,
      text: `
Nuevo registro en "Trabaja con nosotros":

Nombre completo: ${nombreCompleto}
Email: ${email}
Teléfono: ${telefono || 'No proporcionado'}
Cargo al que postula: ${cargo}
Profesión: ${profesion}

Mensaje adicional:
${mensaje || 'Sin mensaje adicional'}

Se adjunta la hoja de vida en este correo.
      `,
      html: `
        <h3>Nuevo registro en "Trabaja con nosotros"</h3>
        <p><strong>Nombre completo:</strong> ${nombreCompleto}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Teléfono:</strong> ${telefono || 'No proporcionado'}</p>
        <p><strong>Cargo al que postula:</strong> ${cargo}</p>
        <p><strong>Profesión:</strong> ${profesion}</p>
        <p><strong>Mensaje adicional:</strong></p>
        <p>${(mensaje || 'Sin mensaje adicional').replace(/\n/g, '<br>')}</p>
        <hr>
        <p>Se adjunta la hoja de vida en este correo.</p>
      `,
      attachments: [
        {
          filename: req.file.originalname,
          path: req.file.path // ruta en tu servidor (uploads/...)
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    res.json({ ok: true, message: 'Postulación enviada correctamente.' });
  } catch (err) {
    console.error('Error en /api/trabaja:', err);
    res.status(500).json({
      ok: false,
      message: 'Error al enviar la postulación.'
    });
  }
});