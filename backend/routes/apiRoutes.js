const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const packageController = require('../controllers/packageController');
const blogController = require('../controllers/blogController');
const bannerController = require('../controllers/bannerController');
const testimonialController = require('../controllers/testimonialController');
const upload = require('../utils/multer');
// Dynamic Multer middleware function
const axios = require('axios');

// Route to send SMS after booking
router.post('/notify-sms', async (req, res) => {
    try {
        const {
            name, mobile, fromDate, toDate,
            adults, children, packageName
        } = req.body;

        const adminPhone = '9048002234';
        const message = `Booking alert: ${name}, ${mobile}, ${packageName}, ${fromDate} to ${toDate}`;

        const response = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
            params: {
                authorization: process.env.FAST2SMS_API_KEY,
                message,
                language: 'english',
                route: 'q',
                numbers: adminPhone,
            }
        });

        res.json({ success: true, response: response.data });
    } catch (err) {
        console.error('SMS failed:', err.response?.data || err.message);
        res.status(500).json({ success: false, error: err.response?.data || err.message });
    }
});




router.get('/categories', categoryController.getAllCategories);
router.post('/categories', upload.single('image'), categoryController.addCategory);
router.put('/categories/:id', upload.single('image'), categoryController.editCategory);
router.delete('/categories/:id', categoryController.deleteCategory);
router.put('/categories/:id/toggle', categoryController.toggleCategory);

// Subcategory routes
router.post('/categories/:categoryId/subcategories', upload.single('image'), categoryController.addSubCategory);
router.put('/categories/:categoryId/subcategories/:subcategoryId', upload.single('image'), categoryController.editSubCategory);
router.delete('/categories/:categoryId/subcategories/:subcategoryId', categoryController.deleteSubCategory);
router.put('/categories/:categoryId/subcategories/:subcategoryId/toggle', categoryController.toggleSubCategory);

// 🏖️ Packages Routes
router.post('/create-package', upload.array('images', 5), packageController.createPackage);
router.get('/all-packages', packageController.getAllPackages);
router.get('/admin-package/:id', packageController.getPackageById);
router.put('/update-package/:id', upload.array('images', 5), packageController.updatePackage);
router.delete('/delete-package/:id', packageController.deletePackage);
router.patch('/toggle-package-status/:id', packageController.togglePackageStatus);

// Category-based endpoints
router.get('/by-category/:categoryId', packageController.getPackagesByCategory);
router.get('/by-subcategory/:subCategoryId', packageController.getPackagesBySubCategory);

// Search and filter endpoints
router.get('/search-packages', packageController.filterPackages);

// 📰 Blogs Routes
router.post('/admin-blogs', upload.single('image'), blogController.createBlog);
router.get('/get-admin-blogs', blogController.getAllBlogs);
router.get('/admin-blogs/:id', blogController.getBlogById);
router.put('/admin-blogs/:id', upload.single('image'), blogController.updateBlog);
router.delete('/admin-blogs/:id', blogController.deleteBlog);

// 🎭 Banners Routes
router.post('/banners', upload.array('images', 5), bannerController.createBanner);
router.get('/banners', bannerController.getAllBanners);
router.get('/banners/:id', bannerController.getBannerById);
router.put('/banners/:id', upload.array('images', 5), bannerController.updateBanner);
router.delete('/banners/:id', bannerController.deleteBanner);
router.patch('/banners/:id/status', bannerController.updateBannerStatus);

// Testimonials
router.post('/admin-testimonials', upload.single('image'), testimonialController.createTestimonial);
router.get('/testimonials', testimonialController.listTestimonials);
router.get('/admin-testimonials/:id', testimonialController.getTestimonialForEdit);
router.put('/admin-testimonials/:id', upload.single('image'), testimonialController.updateTestimonial);
router.delete('/admin-testimonials/:id', testimonialController.deleteTestimonial);
router.patch('/admin-testimonials/toggle-status/:id', testimonialController.toggleTestimonialStatus);

module.exports = router;
