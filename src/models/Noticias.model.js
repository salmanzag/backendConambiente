const mongoose = require('mongoose');

const NoticiasSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  resumen: { type: String, required: true },
  contenido: { type: String, required: true },
  fecha: { type: String, required: true },
  imagenUrl: { type: String, default: '' },
  categoria: { type: String, default: '' }
}, { timestamps: true });

// Mapeo _id -> id para que el frontend siga usando noticia.id
NoticiasSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret.id = ret._id;  // copia el ObjectId a "id"
    delete ret._id;    // ocultamos _id
  }
});

module.exports = mongoose.model('Noticia', NoticiasSchema);
