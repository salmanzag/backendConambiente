const mongoose = require('mongoose');

const ProyectoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  descripcion: { type: String, required: true },
  departamento: { type: String, required: true },
  municipio: { type: String, default: '' },
  estado: { type: String, default: 'En ejecución' },
  fechaInicio: { type: String, default: null },
  fechaFin: { type: String, default: null },
  coordenadas: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  imagenUrl: { type: String, default: '' }
}, { timestamps: true });

// Mapeo _id -> id para que el frontend siga usando proyecto.id
ProyectoSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
  }
});

module.exports = mongoose.model('Proyecto', ProyectoSchema);
