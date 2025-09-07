const express = require('express');
const router = express.Router();
const ClientFile = require('../models/clientFile.model');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');




// @route   GET /api/client-files
// @desc    Obtenir toutes les fiches clients ou les rechercher par nom/prénom.
// @access  Privé (réservé à l'administrateur)
// router.get('/', authMiddleware, async (req, res) => {
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {

    try {

        clientFiles = await ClientFile.find();

        res.status(200).json({ success: true, data: clientFiles });
    } catch (error) {
        console.error('Erreur lors de la récupération des fiches clients :', error);
        res.status(500).json({ success: false, message: 'Échec de la récupération des fiches clients.', error: error.message });
    }
});

// @route   GET /api/client-files/:id
// @desc    Obtenir une fiche client spécifique par son ID.
// @access  Privé (réservé à l'administrateur)
// router.get('/:id', authMiddleware, async (req, res) => {
router.get('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const clientFile = await ClientFile.findById(req.params.id);
        if (!clientFile) {
            return res.status(404).json({ success: false, message: 'Fiche client introuvable.' });
        }
        res.status(200).json({ success: true, data: clientFile });
    } catch (error) {
        console.error('Erreur lors de la récupération de la fiche client :', error);
        res.status(500).json({ success: false, message: 'Échec de la récupération de la fiche client.', error: error.message });
    }
});


// @route   POST /api/client-files
// @desc    Créer une nouvelle fiche client.
// @access  Privé (réservé à l'administrateur)
// router.post('/', authMiddleware, async (req, res) => {
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {

    console.log('Données reçues pour la création de la fiche client :', req.body);

    try {
        const { nom, prenom, email, telephone } = req.body;

        if (!nom || !prenom) {
            return res.status(400).json({ success: false, message: 'Le nom et le prénom sont requis.' });
        }

        const newClientFile = new ClientFile({
            nom,
            prenom,
            email: email || undefined,
            telephone: telephone || undefined,
            historique_seances: []
        });
        const savedClientFile = await newClientFile.save();

        // Conversion explicite en objet JavaScript avant d'envoyer la réponse
        const clientFileResponse = savedClientFile.toObject();

        res.status(201).json({ success: true, data: clientFileResponse });
    } catch (error) {
        console.error('Erreur lors de la création de la fiche client :', error);
        res.status(400).json({ success: false, message: 'Échec de la création de la fiche client.', error: error });
    }
});



// @route   PUT /api/client-files/:id
// @desc    Mettre à jour une fiche client par son ID.
// @access  Privé (réservé à l'administrateur)
// router.put('/:id', authMiddleware, async (req, res) => {
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const updatedClientFile = await ClientFile.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedClientFile) {
            return res.status(404).json({ success: false, message: 'Fiche client introuvable.' });
        }
        res.status(200).json({ success: true, data: updatedClientFile });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la fiche client :', error);
        res.status(400).json({ success: false, message: 'Échec de la mise à jour de la fiche client.', error: error.message });
    }
});

// @route   DELETE /api/client-files/:id
// @desc    Supprimer une fiche client par son ID.
// @access  Privé (réservé à l'administrateur)
// router.delete('/:id', authMiddleware, async (req, res) => {
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const clientFile = await ClientFile.findByIdAndDelete(req.params.id);
        if (!clientFile) {
            return res.status(404).json({ success: false, message: 'Fiche client introuvable.' });
        }
        res.status(200).json({ success: true, message: 'Fiche client supprimée avec succès.' });
    } catch (error) {
        console.error('Erreur lors de la suppression de la fiche client :', error);
        res.status(500).json({ success: false, message: 'Échec de la suppression de la fiche client.', error: error.message });
    }
});

module.exports = router;