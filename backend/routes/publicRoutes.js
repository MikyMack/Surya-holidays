const express = require('express');
const router = express.Router();

const Category = require('../models/Category');
const Package = require('../models/Package');
const Gallery = require('../models/Gallery');
const Banner = require('../models/Banner');
const Blog = require('../models/Blog');
const Testimonial = require('../models/Testimonial');

router.get('/', async (req, res) => {
    try {
        // Fetch active banners data
        const banners = await Banner.find({ isActive: true }).sort({ createdAt: -1 });
        
        // Fetch all categories
        const categories = await Category.find({ isActive: true })
            .select('name imageUrl subCategories')
            .lean();

        // Fetch Kerala category specifically
        const keralaCategory = await Category.findOne({ name: 'Kerala', isActive: true })
            .select('name imageUrl subCategories')
            .lean();

        // Fetch packages with populated category and subCategory
        const packages = await Package.find({ isActive: true })
            .populate({
                path: 'category',
                select: 'name imageUrl'
            })
            .populate({
                path: 'subCategory',
                select: 'name imageUrl',
                match: { isActive: true }
            })
            .lean();

        // Fetch blogs
        const blogs = await Blog.find().sort({ createdAt: -1 }).limit(3);
        const testimonials = await Testimonial.find().sort({ createdAt: -1 }).limit(10);

        // Group packages under their respective categories
        const categoryMap = categories.map(category => {
            const categoryPackages = packages.filter(pkg => 
                pkg.category?._id.toString() === category._id.toString()
            );
            const directPackages = categoryPackages.filter(pkg => !pkg.subCategory);
            
            return {
                ...category,
                subCategories: category.subCategories.filter(sub => sub.isActive),
                packages: categoryPackages,
                directPackages: directPackages,
                locationCount: categoryPackages.length
            };
        });

        // Process Kerala category packages
        const keralaPackages = packages.filter(pkg => 
            pkg.category?.name === 'Kerala'
        );
        const keralaDirectPackages = keralaPackages.filter(pkg => !pkg.subCategory);

        const keralaCategoryData = keralaCategory ? {
            ...keralaCategory,
            subCategories: keralaCategory.subCategories.filter(sub => sub.isActive),
            packages: keralaPackages,
            directPackages: keralaDirectPackages,
            locationCount: keralaPackages.length
        } : null;

        // Processed package list with short description
        const processedPackages = packages.map(pkg => ({
            ...pkg,
            categoryName: pkg.category?.name || 'Deleted Category',
            categoryImage: pkg.category?.imageUrl || '',
            subCategoryName: pkg.subCategory?.name || null,
            subCategoryImage: pkg.subCategory?.imageUrl || null,
            shortDescription: pkg.packageDescription
                ? pkg.packageDescription.split(' ').slice(0, 20).join(' ') + 
                  (pkg.packageDescription.split(' ').length > 20 ? '...' : '')
                : ''
        }));

        res.render('index', { 
            title: 'Home Page',
            banners: banners,
            categories: categoryMap,
            keralaCategories: keralaCategoryData,
            packages: processedPackages,
            featuredPackages: processedPackages.slice(0, 3),
            blogs: blogs,
            testimonials: testimonials,
            discount: Math.random() > 0.9 ? Math.floor(Math.random() * 15) + 10 : 0,
            query: req.query
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading home page data');
    }
});

router.get('/about', async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true })
            .select('name imageUrl subCategories')
            .lean();

        const blogs = await Blog.find().sort({ createdAt: -1 }).limit(3);

        const gallery = await Gallery.find().sort({ createdAt: -1 }).limit(20);
        const testimonials = await Testimonial.find().sort({ createdAt: -1 }).limit(10);

        res.render('about', { 
            title: 'About Us',
            categories: categories,
            blogs: blogs,
            gallery: gallery,
            testimonials
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading about us page data');
    }
});
router.get('/blogs', async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        // Fetch blogs with pagination
        const blogs = await Blog.find()
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        // Fetch categories
        const categories = await Category.find({ isActive: true })
            .select('name imageUrl subCategories')
            .lean();

        // Get total number of blogs for pagination
        const totalBlogs = await Blog.countDocuments();

        res.render('blogs', { 
            title: 'Blogs',
            blogs: blogs,
            categories: categories,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalBlogs / limit)
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading blogs page data');
    }
});
router.get('/gallery', async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const packages = await Package.find({ isActive: true })
            .populate({
                path: 'category',
                select: 'name imageUrl'
            })
            .populate({
                path: 'subCategory',
                select: 'name imageUrl',
                match: { isActive: true }
            })
            .lean();

        const categories = await Category.find({ isActive: true })
            .select('name imageUrl subCategories')
            .lean();

        const categoryMap = categories.map(category => ({
            ...category,
            subCategories: category.subCategories.filter(sub => sub.isActive),
            packages: packages.filter(pkg => pkg.category?._id.toString() === category._id.toString())
        }));

        const totalGalleryItems = await Gallery.countDocuments();
        const gallery = await Gallery.find()
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.render('gallery', { 
            title: 'Gallery', 
            categories: categoryMap, 
            gallery,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalGalleryItems / limit)
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading gallery page data');
    }
});

router.get('/contact', async (req, res) => {
    try {
        res.render('contact', { title: 'contact us'});
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading contact page data');
    }
});
router.get('/packages', async (req, res) => {
    try {
        const { category, subCategory, search, page = 1, limit = 10 } = req.query;
        let query = { isActive: true };
        
        // Build query based on filters
        if (category) {
            query.category = category;
        }
        if (subCategory) {
            query.subCategory = subCategory;
        }
        if (search && search.length >= 3) {  // Only search if 3+ characters
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { 'category.name': { $regex: search, $options: 'i' } },
                { 'subCategory.name': { $regex: search, $options: 'i' } }
            ];
        }

        const packages = await Package.find(query)
            .populate('category', 'name')
            .populate('subCategory', 'name')
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const totalPackages = await Package.countDocuments(query);

        const categories = await Category.find({ isActive: true })
            .populate({
                path: 'subCategories',
                match: { isActive: true }
            });

        // Get the selected category name
        const selectedCategoryData = category ? await Category.findById(category).select('name') : null;

        res.render('packages', {
            title: 'Tour Packages',
            packages,
            categories,
            currentCategory: category,
            currentSubCategory: subCategory,
            searchTerm: search,
            selectedCategory: selectedCategoryData ? selectedCategoryData.name : null,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalPackages / limit),
            query: req.query 
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Package details page
router.get('/package/:id', async (req, res) => {
    try {
        const tourPackage = await Package.findById(req.params.id)
            .populate('category', 'name')
            .populate('subCategory', 'name');

        if (!tourPackage) {
            return res.status(404).render('comming-soon', {
                message: 'Package not found'
            });
        }

        const categories = await Category.find({ isActive: true })
            .select('name imageUrl subCategories')
            .lean();

        res.render('packageDetails', {
            title: tourPackage.title,
            tourPackage,
            categories
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});


// Package details by subcategory
router.get('/package-details', async (req, res) => {
    try {
        const { subCategory } = req.query;
        
        // 1. Get the subcategory with its parent category details
        const category = await Category.findOne(
            { 'subCategories._id': subCategory },
            { 
                name: 1,
                'subCategories.$': 1 
            }
        );

        if (!category || !category.subCategories || category.subCategories.length === 0) {
            return res.status(404).render('comming-soon', {
                message: 'Subcategory not found'
            });
        }

        const subCategoryData = category.subCategories[0];
        
        // 2. Get the FIRST package in this subcategory
        const package = await Package.findOne({
            subCategory: subCategory,
            isActive: true
        })
        .populate('category', 'name')
        .populate('subCategory', 'name');

        if (!package) {
            return res.status(404).render('comming-soon', {
                message: 'No packages found in this subcategory'
            });
        }
        const categories = await Category.find({ isActive: true })
        .select('name imageUrl subCategories')
        .lean();

        res.render('packageDetails', {
            title: package.title || subCategoryData.name,
            package: package,  // Pass the single package object
            subCategory: subCategoryData,
            parentCategory: {
                _id: category._id,
                name: category.name
            },
            categories
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});
router.get('/blogdetails', async (req, res) => {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).send('Blog ID is required');
        }

        const blog = await Blog.findById(id).lean();

        if (!blog) {
            return res.status(404).send('Blog not found');
        }

        const categories = await Category.find({ isActive: true })
            .select('name imageUrl subCategories')
            .lean();

        // Fetch related blogs, excluding the current blog, limit to 3
        const relatedBlogs = await Blog.find({ _id: { $ne: id } })
            .sort({ createdAt: -1 })
            .limit(3)
            .lean();

        res.render('blogdetails', { 
            title: blog.title || 'Blog Details',
            blog: blog,
            relatedBlogs: relatedBlogs,
            categories
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading blog details page data');
    }
});

router.get('/packagedetails', async (req, res) => {
    try {
        res.render('packagedetails', { title: 'Package Details' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading package details page data');
    }
});





module.exports = router;