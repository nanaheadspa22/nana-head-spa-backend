const User = require('../models/user.model.js');
const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const dotenv = require('dotenv');
const { sendResetPasswordEmail } = require('../utils/emailService.js');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const path = require('path');

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

        const cookieDomain = process.env.NODE_ENV === 'production'
            ? '.nanaheadspa.com'
            : 'localhost';

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Mieux de le lier à l'environnement
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax', // 'None' en production pour CORS, 'Lax' en local est plus sécurisé
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
            path: '/',
            domain: cookieDomain // ✅ Active cette ligne !
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
        console.log("Cookie reçu :", req.cookies.token);
        console.log("Headers :", req.headers);
    } catch (err) {
        console.error("Erreur serveur lors de la connexion :", err); // Ajout d'un log plus précis
        res.status(500).send({ success: false, message: 'Erreur serveur interne lors de la connexion.', error: err.message });
    }
});


router.post('/logout', (req, res) => {
    const cookieDomain = process.env.NODE_ENV === 'production'
        ? '.nanaheadspa.com'
        : 'localhost';

    res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
        domain: cookieDomain,
        path: '/'
    });
    res.status(200).send({ success: true, message: "Déconnecté." });
});



router.post('/forgot-password', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            return res.status(404).send({ success: false, message: 'Aucun utilisateur trouvé avec cet email.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const resetPasswordExpires = Date.now() + 3600000; // Expire dans 1 heure

        user.resetPasswordToken = resetPasswordToken;
        user.resetPasswordExpires = resetPasswordExpires;

        await user.save();

        const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;

        // Utilise la nouvelle fonction d'envoi d'e-mail
        await sendResetPasswordEmail(user.email, user.firstName, resetUrl);

        res.status(200).send({ success: true, message: 'Un lien de réinitialisation a été envoyé à votre email.' });

    } catch (err) {
        // En cas d'erreur, efface les champs pour éviter de bloquer l'utilisateur
        if (user) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
        }
        console.error("Erreur serveur lors de la demande de réinitialisation :", err);
        res.status(500).send({ success: false, message: 'Erreur serveur lors de la demande de réinitialisation.' });
    }
});



router.put('/reset-password/:token',
    [
        body('password')
            .isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères.')
            .matches(/[a-z]/).withMessage('Le mot de passe doit contenir au moins une lettre minuscule.')
            .matches(/[A-Z]/).withMessage('Le mot de passe doit contenir au moins une lettre majuscule.')
            .matches(/[0-9]/).withMessage('Le mot de passe doit contenir au moins un chiffre.')
            .matches(/[^a-zA-Z0-9]/).withMessage('Le mot de passe doit contenir au moins un caractère spécial.'),
        body('confirmPassword').custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Les mots de passe ne correspondent pas.');
            }
            return true;
        }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).send({ success: false, errors: errors.array() });
        }

        try {
            const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

            const user = await User.findOne({
                resetPasswordToken,
                resetPasswordExpires: { $gt: Date.now() },
            });

            if (!user) {
                return res.status(400).send({ success: false, message: 'Jeton de réinitialisation invalide ou expiré.' });
            }

            user.password = bcrypt.hashSync(req.body.password, 10);
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            await user.save();

            res.status(200).send({ success: true, message: 'Mot de passe réinitialisé avec succès.' });

        } catch (err) {
            res.status(500).send({ success: false, message: 'Erreur serveur lors de la réinitialisation du mot de passe.' });
        }
    }
);

module.exports = router;