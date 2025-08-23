const User = require('../models/user.model.js');
const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const dotenv = require('dotenv');


dotenv.config();
const secret = process.env.PASS_SEC




//Création d'un compte utilisateur
router.post('/register', async (req, res) => {

    try {
        // Vérifier si l'utilisateur existe déjà
        const userExists = await User.findOne({ email: req.body.email });
        if (userExists) {
            return res.status(409).send({ success: false, message: 'Cet utilisateur existe déjà.' });
        }

        // Création d'un nouvel utilisateur
        const hashedPassword = bcrypt.hashSync(req.body.password, 10);
        const newUser = new User({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            phone: req.body.phone,
            password: hashedPassword,
            isAdmin: req.body.isAdmin || false, // Prend la valeur transmise ou utilise false par défaut
        });

        const savedUser = await newUser.save();

        res.status(201).send({
            success: true,
            message: 'Utilisateur créé avec succès.',
            data: {
                id: savedUser._id,
                firstName: savedUser.firstName,
                lastName: savedUser.lastName,
                phone: savedUser.phone,
                email: savedUser.email,
                isAdmin: savedUser.isAdmin,
            },
        });
    } catch (err) {
        res.status(500).send({ success: false, message: 'Erreur serveur.', error: err.message });
    }

})


// Route de connexion
router.post('/login', async (req, res) => {

    //console.log("tentative de login", req.body)
    // Validation des entrées utilisateur avec Joi
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
    });

    const { error } = schema.validate(req.body);
    if (error) return res.status(400).send({ success: false, message: error.details[0].message });

    try {
        // Recherche de l'utilisateur par email, EN INCLUANT LE MOT DE PASSE
        const user = await User.findOne({ email: req.body.email }).select('+password'); // <--  .select('+password') ICI

        if (!user) {
            return res.status(404).send({ success: false, message: 'Utilisateur introuvable.' });
        }

        // Vérification du mot de passe
        // user.password devrait maintenant contenir le hash du mot de passe
        const validPassword = bcrypt.compareSync(req.body.password, user.password);
        if (!validPassword) {
            return res.status(401).send({ success: false, message: 'Mot de passe incorrect.' });
        }

        // Création du token JWT
        const secret = process.env.JWT_SECRET; // Assurez-vous que JWT_SECRET est défini dans .env
        const token = jwt.sign(
            {
                userId: user._id,
                isAdmin: user.role === 'admin', // Utilisez user.role pour isAdmin si vous avez un champ 'role'
            },
            secret,
            { expiresIn: '1d' }
        );

        res.cookie('token', token, {
            httpOnly: true, // Empêche l'accès via JavaScript côté client
            //secure: process.env.NODE_ENV === 'production', // true si HTTPS en production
            secure: true,
            sameSite: 'None', // Protection CSRF. 'None' avec 'secure: true' si nécessaire pour CORS strict.
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expiration 1 jour (doit correspondre à expiresIn du JWT)
            path: '/', // Rend le cookie accessible sur toutes les routes
            //sameSite: 'Lax', // en local
            //domain: '.nanaheadspa.com', // 🔥 pour partager entre api.nanaheadspa.com et nanaheadspa
            //domain: 'localhost', // ✅ TRÈS IMPORTANT pour le développement local

        });

        // Réponse avec le token
        res.status(200).send({
            success: true,
            message: 'Connexion réussie.',
            //token: token,
            data: {
                id: user._id, // Utilise _id comme ID
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                role: user.role,

                // N'envoyez pas le mot de passe ou le hash du mot de passe ici
            },
        });
    } catch (err) {
        console.error("Erreur serveur lors de la connexion :", err); // Ajout d'un log plus précis
        res.status(500).send({ success: false, message: 'Erreur serveur interne lors de la connexion.', error: err.message });
    }
});


router.post('/logout', (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: "None",
        //sameSite: 'Lax', // en local
    });
    res.status(200).send({ success: true, message: "Déconnecté." });
});


module.exports = router;