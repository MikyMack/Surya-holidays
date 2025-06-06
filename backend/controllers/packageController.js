const Package = require('../models/Package');
const cloudinary = require('../utils/cloudinary');
const upload= require('../utils/multer');
const Category = require('../models/Category');

const deleteImages = async (images) => {
    if (!images || !images.length) return;

    await Promise.all(images.map(async (imageUrl) => {
        try {
            // Extract the public ID from the URL
            const urlParts = imageUrl.split('/');
            const uploadIndex = urlParts.indexOf('upload');
            
            // The public ID consists of everything after 'upload/' and before the file extension
            const publicIdWithVersion = urlParts.slice(uploadIndex + 1).join('/').split('.')[0];
            
            // Remove the version prefix (v1742949786/)
            const publicId = publicIdWithVersion.replace(/^v\d+\//, '');


            const result = await cloudinary.uploader.destroy(publicId);
            
            if (result.result === 'not found') {
                console.log(`Image already deleted: ${publicId}`);
            } else if (result.result !== 'ok') {
                console.error(`Failed to delete image: ${publicId}`, result);
            }

            
        } catch (error) {
            console.error(`Error deleting image ${imageUrl}:`, error.message);
        }
    }));
};
  
  // Create package
  exports.createPackage = async (req, res) => {
    try {
        const { 
            title, destination, categories, subCategories, duration, 
            tourType, groupSize, tourGuide, packageDescription, 
            included, travelPlan, locationHref, packagePrice
        } = req.body;

        // Validate images
        if (!req.files || req.files.length < 2 || req.files.length > 5) {
            return res.status(400).json({ 
                message: 'Please provide between 2 to 5 images' 
            });
        }

        // Parse categories and subCategories from JSON strings to arrays
        const categoriesArray = JSON.parse(categories);
        const subCategoriesArray = subCategories ? JSON.parse(subCategories) : [];

        const images = req.files.map(file => file.path);
        const includedArray = typeof included === 'string' ? JSON.parse(included) : included;
        const travelPlanArray = typeof travelPlan === 'string' ? JSON.parse(travelPlan) : travelPlan;

        const newPackage = new Package({
            title,
            destination,
            categories: categoriesArray,
            subCategories: subCategoriesArray,
            duration,
            tourType,
            groupSize,
            tourGuide,
            packageDescription,
            packagePrice,
            included: includedArray,
            travelPlan: travelPlanArray,
            locationHref,
            images
        });

        await newPackage.save();
        
        // Populate the created package before returning
        const populatedPackage = await Package.findById(newPackage._id)
            .populate('categories')
            .populate('subCategories');
        
        res.status(201).json(populatedPackage);
    } catch (error) {
        console.error('Error creating package:', error);
        res.status(400).json({ 
            message: error.message.includes('validation failed') 
                ? error.message 
                : 'Error creating package'
        });
    }
};
  
  // Get all packages (with optional query params)
  exports.getAllPackages = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const skip = (page - 1) * limit;
        
        // Build search query
        const query = {};
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { destination: { $regex: search, $options: 'i' } },
                { 'categories.name': { $regex: search, $options: 'i' } },
                { 'subCategories.name': { $regex: search, $options: 'i' } }
            ];
        }

        const [packages, totalCount] = await Promise.all([
            Package.find(query)
                .sort({ createdAt: -1 }) 
                .skip(skip)
                .limit(parseInt(limit))
                .populate('categories', 'name subCategories') 
                .populate({
                    path: 'subCategories', 
                    select: 'name -_id' 
                }),
            Package.countDocuments(query)
        ]);

        res.json({
            packages,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: parseInt(page),
            totalCount
        });
    } catch (error) {
        console.error('Error fetching packages:', error);
        res.status(500).json({ 
            message: 'Error fetching packages',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
  
  // Get single package
  exports.getPackageById = async (req, res) => {
    try {
        const package = await Package.findById(req.params.id)
            .populate('categories')
            .populate('subCategories');
            
        if (!package) {
            return res.status(404).json({ message: 'Package not found' });
        }
        res.json(package);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
  // Update package
  exports.updatePackage = async (req, res) => {
    try {
        const package = await Package.findById(req.params.id);
        if (!package) {
            return res.status(404).json({ message: 'Package not found' });
        }

        // Delete old images if new ones are uploaded
        if (req.files && req.files.length > 0) {
            await deleteImages(package.images);
        }

        // Convert checkbox value to boolean
        const isActive = req.body.isActive === 'on' ? true : false;

        // Parse categories and subCategories from JSON strings to arrays
        const categoriesArray = typeof req.body.categories === 'string' 
            ? JSON.parse(req.body.categories) 
            : Array.isArray(req.body.categories) 
                ? req.body.categories 
                : req.body.categories 
                    ? [req.body.categories] 
                    : [];

        const subCategoriesArray = typeof req.body.subCategories === 'string' 
            ? JSON.parse(req.body.subCategories) 
            : Array.isArray(req.body.subCategories) 
                ? req.body.subCategories 
                : req.body.subCategories 
                    ? [req.body.subCategories] 
                    : [];

        // Validate categories exist
        const existingCategories = await Category.find({ 
            _id: { $in: categoriesArray } 
        });
        
        if (existingCategories.length !== categoriesArray.length) {
            return res.status(400).json({ 
                message: 'One or more categories not found' 
            });
        }

        // Validate subcategories if provided
        if (subCategoriesArray.length > 0) {
            const validSubCategories = existingCategories.flatMap(cat => 
                cat.subCategories.map(sub => sub._id.toString())
            );
            
            const allValid = subCategoriesArray.every(subId => 
                validSubCategories.includes(subId.toString())
            );
            
            if (!allValid) {
                return res.status(400).json({ 
                    message: 'One or more subcategories do not belong to the selected categories' 
                });
            }
        }

        const updates = {
            ...req.body,
            categories: categoriesArray,
            subCategories: subCategoriesArray,
            isActive,
            images: req.files?.length ? req.files.map(file => file.path) : package.images,
            included: typeof req.body.included === 'string' ? JSON.parse(req.body.included) : req.body.included,
            travelPlan: typeof req.body.travelPlan === 'string' ? JSON.parse(req.body.travelPlan) : req.body.travelPlan,
        };

        const updatedPackage = await Package.findByIdAndUpdate(
            req.params.id, 
            updates, 
            { new: true }
        )
        .populate('categories')
        .populate('subCategories');

        res.json(updatedPackage);
    } catch (error) {
        console.error('Error updating package:', error);
        res.status(400).json({ 
            message: error.message.includes('validation failed') 
                ? error.message 
                : 'Error updating package'
        });
    }
};
  
  // Delete package
  exports.deletePackage = async (req, res) => {
    try {
      const package = await Package.findById(req.params.id);
      if (!package) {
        return res.status(404).json({ message: 'Package not found' });
      }
  
      await deleteImages(package.images);
      await Package.findByIdAndDelete(req.params.id);
      
      res.json({ message: 'Package deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
  
  // Toggle package status
  exports.togglePackageStatus = async (req, res) => {
    try {
      const package = await Package.findById(req.params.id);
      if (!package) {
        return res.status(404).json({ message: 'Package not found' });
      }
  
      package.isActive = !package.isActive;
      await package.save();
      
      res.json(package);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  };
  
  // Get packages by category
  exports.getPackagesByCategory = async (req, res) => {
    try {
      const packages = await Package.find({ 
        category: req.params.categoryId,
        isActive: true 
      }).populate('subCategory');
      
      res.json(packages);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
  
  // Get packages by subcategory
  exports.getPackagesBySubCategory = async (req, res) => {
    try {
      const packages = await Package.find({ 
        subCategory: req.params.subCategoryId,
        isActive: true 
      }).populate('category');
      
      res.json(packages);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
  
  // Filter/search packages
  exports.filterPackages = async (req, res) => {
    try {
      const { 
        destination, 
        category, 
        subCategory, 
        duration, 
        tourType, 
        minGroupSize, 
        maxGroupSize 
      } = req.query;
  
      let query = { isActive: true };
  
      if (destination) query.destination = new RegExp(destination, 'i');
      if (category) query.category = category;
      if (subCategory) query.subCategory = subCategory;
      if (duration) query.duration = duration;
      if (tourType) query.tourType = tourType;
      
      if (minGroupSize || maxGroupSize) {
        query.groupSize = {};
        if (minGroupSize) query.groupSize.$gte = parseInt(minGroupSize);
        if (maxGroupSize) query.groupSize.$lte = parseInt(maxGroupSize);
      }
  
      const packages = await Package.find(query)
        .populate('category')
        .populate('subCategory');
        
      res.json(packages);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
