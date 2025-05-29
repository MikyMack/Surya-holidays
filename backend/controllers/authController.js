// controllers/authController.js
const User = require('../models/User'); 

exports.login = async (req, res) => {
    const { email, password } = req.body;
    
    if (email === 'admin@Surya.com' && password === 'admin@admin') {
        req.session.user = { email };
        res.redirect('/dashboard');
    } else {
        res.render('admin-login', { title: 'Admin Login', error: 'Invalid email or password' });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/dashboard');
        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
};
