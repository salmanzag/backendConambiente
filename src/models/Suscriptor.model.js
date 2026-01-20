const mongoose = require('mongoose');

const SuscriptorSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  activo: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Suscriptor', SuscriptorSchema);

