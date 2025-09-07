const mongoose = require('mongoose');

// On définit le schéma pour une séance de soin
const sessionSchema = new mongoose.Schema({
    date_seance: {
        type: Date,
        required: true,
    },
    problematique: {
        type: String,
        required: true,
    },
    huiles_essentielles: {
        type: [String],
        default: [],
    },
    notes: {
        type: String,
    },
});

// On définit le schéma principal pour la fiche client
const clientFileSchema = new mongoose.Schema({
    nom: {
        type: String,
        required: true,
        trim: true,
    },
    prenom: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        trim: true,

    },
    telephone: {
        type: String,
        trim: true,
    },
    historique_seances: [sessionSchema],
}, { timestamps: true });



const ClientFile = mongoose.model('ClientFile', clientFileSchema);

module.exports = ClientFile;