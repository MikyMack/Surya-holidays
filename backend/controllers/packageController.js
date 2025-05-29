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
        title, destination, category, subCategory, duration, 
        tourType, groupSize, tourGuide, packageDescription, 
        included, travelPlan, locationHref ,packagePrice
      } = req.body;
  
      // Validate images
      if (!req.files || req.files.length < 2 || req.files.length > 5) {
        return res.status(400).json({ 
          message: 'Please provide between 2 to 5 images' 
        });
      }

      // Validate category and subcategory relationship
      let validSubCategory = null;
      if (subCategory) {
        const parent = await Category.findOne({ 
          '_id': category,
          'subCategories._id': subCategory 
        });
        
        if (!parent) {
          return res.status(400).json({ 
            message: 'Subcategory does not belong to the selected category' 
          });
        }
        validSubCategory = subCategory;
      }
  
      const images = req.files.map(file => file.path);
      const includedArray = typeof included === 'string' ? JSON.parse(included) : included;
      const travelPlanArray = typeof travelPlan === 'string' ? JSON.parse(travelPlan) : travelPlan;
  
      const newPackage = new Package({
        title,
        destination,
        category,
        subCategory: validSubCategory, // Use the validated subcategory
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
        .populate('category')
        .populate('subCategory');
      
      res.status(201).json(populatedPackage);
    } catch (error) {
      console.error('Error creating package:', error);
      res.status(400).json({ 
        message: error.message.includes('validation failed') 
          ? 'Validation error: ' + error.message 
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
          { 'category.name': { $regex: search, $options: 'i' } },
          { 'subCategory.name': { $regex: search, $options: 'i' } }
        ];
      }
  
      const [packages, totalCount] = await Promise.all([
        Package.find(query)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('category', 'name subCategories')
            .populate({
                path: 'subCategory',
                select: 'name -_id' // Only get name, exclude _id
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
      res.status(500).json({ message: 'Error fetching packages' });
    }
};
  
  // Get single package
  exports.getPackageById = async (req, res) => {
    try {
      const package = await Package.findById(req.params.id)
        .populate('category')
        .populate('subCategory');
        
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
  
      const updates = {
        ...req.body,
        isActive,
        images: req.files?.length ? req.files.map(file => file.path) : package.images,
        included: JSON.parse(req.body.included),
        travelPlan: JSON.parse(req.body.travelPlan),
        subCategory: req.body.subCategory === '' ? null : req.body.subCategory,
      };
      
      // Validate subcategory if being updated
      if (updates.subCategory && updates.subCategory !== package.subCategory?.toString()) {
        const parent = await Category.findOne({ 'subCategories._id': updates.subCategory });
        if (!parent || parent._id.toString() !== updates.category) {
          return res.status(400).json({ 
            message: 'Subcategory does not belong to the selected category' 
          });
        }
      }
  
      const updatedPackage = await Package.findByIdAndUpdate(
        req.params.id, 
        updates, 
        { new: true }
      );
  
      res.json(updatedPackage);
    } catch (error) {
      res.status(400).json({ message: error.message });
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
