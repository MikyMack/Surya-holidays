const express = require('express');
const Category = require("../models/Category")
const Package = require("../models/Package")
const Banner = require("../models/Banner")
const app = express();
const cloudinary = require('../utils/cloudinary');
const upload = require('../utils/multer');

const authMiddleware = require('../middleware/auth'); 
const authController =require('../controllers/authController');
const Gallery = require('../models/Gallery');
const Blogs = require('../models/Blog');

// Admin Login Page
app.get('/login', (req, res) => {
    res.render('admin-login', { title: 'Admin Login' });
});
app.get('/logout', authController.logout);

app.get('/dashboard', authMiddleware, async (req, res) => {
    try {
        const packages = await Package.find();
        const categories = await Category.find();
        res.render('admin-dashboard', { title: 'Admin Dashboard', categories, packages });
    } catch (error) {
        res.status(500).send("Internal Server Error");
    }
});

app.get('/admin-category', authMiddleware, async (req, res) => {
    try {

        const categories = await Category.find().populate('subCategories'); 

        res.render('admin-categories', { title: 'Admin Categories', categories });
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).send("Internal Server Error");
    }
});
app.get('/admin-blogs',authMiddleware, (req, res) => {
  res.render('admin-blogs');
});
app.get('/admin-testimonials',authMiddleware, (req, res) => {
  res.render('admin-testimonials');
});
app.get('/admin-banner', authMiddleware, async (req, res) => {
    try {

        const banners = await Banner.find(); 

        res.render('admin-banner', { title: 'Admin banners', banners });
    } catch (error) {
        console.error("Error fetching banner:", error);
        res.status(500).send("Internal Server Error");
    }
});
app.get('/admin-gallery', authMiddleware, async (req, res) => {
    try {

        const galleryItems = await Gallery.find(); 

        res.render('admin-gallery', { title: 'Admin Galleries', galleryItems });
    } catch (error) {
        console.error("Error fetching gallery:", error);
        res.status(500).send("Internal Server Error");
    }
});
app.get('/admin-packages', authMiddleware, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10; 
        const page = parseInt(req.query.page) || 1; 
        const searchQuery = req.query.search || ''; 
        const totalProducts = await Package.countDocuments({ title: { $regex: searchQuery, $options: 'i' } }); // Get total number of packages matching search query
        const packages = await Package.find({ title: { $regex: searchQuery, $options: 'i' } })
            .skip((page - 1) * limit)
            .limit(limit);

        res.render('admin-packages', {
            title: 'Admin Packages',
            packages,
            limit: Number(limit),
            currentPage: Number(page),
            totalPages: Math.ceil(totalProducts / limit),
            searchQuery
        });
    } catch (error) {
        res.status(500).send("Internal Server Error");
    }
});


// create gallery 
app.post('/create-gallery', upload.single('image'),authMiddleware, async (req, res) => {
    try {
      if (!req.body.title) {
        return res.status(400).json({ error: 'Title is required' });
      }
  
      if (!req.file) {
        return res.status(400).json({ error: 'Image file is required' });
      }
  
      const galleryItem = new Gallery({
        title: req.body.title,
        imageUrl: req.file.path
      });
  
      await galleryItem.save();
      res.status(201).json(galleryItem);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });
// list gallery
  app.get('/list-gallery',authMiddleware, async (req, res) => {
    try {
      const galleryItems = await Gallery.find().sort({ createdAt: -1 });
      res.json(galleryItems);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.get('/single-gallery/:id',authMiddleware, async (req, res) => {
    try {
      const galleryItem = await Gallery.findById(req.params.id);
      if (!galleryItem) {
        return res.status(404).json({ error: 'Gallery item not found' });
      }
      res.json(galleryItem);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // @route  edit
app.put('/edit-gallery/:id', upload.single('image'),authMiddleware, async (req, res) => {
    try {
      const updateData = { title: req.body.title };
      
      if (req.file) {
        updateData.imageUrl = req.file.path;
        // Optional: Delete old image from Cloudinary
      }
  
      const galleryItem = await Gallery.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );
  
      if (!galleryItem) {
        return res.status(404).json({ error: 'Gallery item not found' });
      }
  
      res.json(galleryItem);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  // @route   DELETE 
  app.delete('/delete-gallery/:id',authMiddleware, async (req, res) => {
    try {
      const galleryItem = await Gallery.findByIdAndDelete(req.params.id);
      
      if (!galleryItem) {
        return res.status(404).json({ error: 'Gallery item not found' });
      }
  
      // Delete from Cloudinary
      const publicId = galleryItem.imageUrl.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`Jonna-holidays/${publicId}`);
  
      res.json({ message: 'Gallery item deleted successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });



module.exports = app;