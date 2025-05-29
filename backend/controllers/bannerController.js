const Banner = require('../models/Banner');
const cloudinary = require('../utils/cloudinary');

exports.createBanner = async (req, res) => {
    try {
        // Verify files were uploaded
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one image file is required'
            });
        }

        // Upload images to Cloudinary
        const imageUploadPromises = req.files.map(file => cloudinary.uploader.upload(file.path, {
            folder: 'banners',
            quality: 'auto:good'
        }));

        const uploadResults = await Promise.all(imageUploadPromises);

        // Create banner object
        const banner = new Banner({
            title: req.body.title,
            images: uploadResults.map(result => ({ url: result.secure_url })),
            isActive: req.body.isActive === 'true'
        });

        // Save to database
        await banner.save();

        res.status(201).json({
            success: true,
            data: banner
        });

    } catch (error) {
        console.error('Error creating banner:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error creating banner'
        });
    }
};

exports.getAllBanners = async (req, res) => {
    try {
        const banners = await Banner.find();
        res.status(200).json(banners);
    } catch (error) {
        res.status(500).json({ message: "Error retrieving banners", error: error.message });
    }
};

exports.getBannerById = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) return res.status(404).json({ message: "Banner not found" });
        res.status(200).json(banner);
    } catch (error) {
        res.status(500).json({ message: "Error retrieving banner", error: error.message });
    }
};

exports.updateBanner = async (req, res) => {
    try {
        const { title } = req.body;
        const banner = await Banner.findById(req.params.id);
        
        if (!banner) {
            return res.status(404).json({ 
                success: false,
                message: "Banner not found" 
            });
        }

        // Handle image update if new files provided
        if (req.files && req.files.length > 0) {
            try {
                // Delete old images from Cloudinary
                const deletePromises = banner.images.map(image => cloudinary.uploader.destroy(image.cloudinary_id));
                await Promise.all(deletePromises);

                // Upload new images
                const imageUploadPromises = req.files.map(file => cloudinary.uploader.upload(file.path, {
                    folder: 'banners',
                    quality: 'auto:good'
                }));

                const uploadResults = await Promise.all(imageUploadPromises);

                banner.images = uploadResults.map(result => ({ url: result.secure_url, cloudinary_id: result.public_id }));

            } catch (uploadError) {
                console.error('Image upload error:', uploadError);
                return res.status(500).json({
                    success: false,
                    message: "Error uploading images",
                    error: uploadError.message
                });
            }
        }

        // Update other fields
        banner.title = title || banner.title;
        
        await banner.save();
        
        res.status(200).json({
            success: true,
            message: "Banner updated successfully",
            banner
        });

    } catch (error) {
        console.error('Banner update error:', error);
        res.status(500).json({
            success: false,
            message: "Error updating banner",
            error: error.message
        });
    }
};

exports.deleteBanner = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) {
            return res.status(404).json({ 
                success: false,
                message: "Banner not found" 
            });
        }

        // Attempt to delete images from Cloudinary
        try {
            const deletePromises = banner.images.map(image => {
                const publicId = image.url.split('/').slice(-1)[0].split('.')[0]; // Extract public_id from URL
                return cloudinary.uploader.destroy(`banners/${publicId}`);
            });
            await Promise.all(deletePromises);
        } catch (cloudinaryError) {
            console.error('Cloudinary deletion error:', cloudinaryError);
            return res.status(500).json({
                success: false,
                message: "Error deleting images from Cloudinary",
                error: cloudinaryError.message
            });
        }

        // Delete from database
        await Banner.findByIdAndDelete(req.params.id);

        res.status(200).json({ 
            success: true,
            message: "Banner deleted successfully" 
        });

    } catch (error) {
        console.error('Banner deletion error:', error);
        res.status(500).json({ 
            success: false,
            message: "Error deleting banner",
            error: error.message 
        });
    }
};

exports.updateBannerStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        const banner = await Banner.findByIdAndUpdate(
            id,
            { isActive },
            { new: true }
        );

        if (!banner) {
            return res.status(404).json({ message: 'Banner not found' });
        }

        res.json(banner);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};