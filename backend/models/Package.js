const mongoose = require('mongoose');

const PackageSchema = new mongoose.Schema({
    title: { type: String, required: true },
    destination: { type: String, required: true },
    categories: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Category', 
        required: true 
    }],
    subCategories: [{ 
        type: mongoose.Schema.Types.ObjectId,
        required: false
    }],
    duration: { type: String, required: true },
    tourType: { type: String, required: true },
    groupSize: { type: Number, required: true },
    tourGuide: { type: String, required: true },
    packageDescription: { type: String, required: true },
    packagePrice: { type: Number, required: false },
    included: [{ type: String, required: true }],
    travelPlan: [{
        day: { type: String, required: true },
        description: { type: String, required: true }
    }],
    locationHref: { type: String, required: true },
    images: [{ 
        type: String, 
        required: true, 
    }],
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

PackageSchema.pre('validate', async function(next) {
    if (this.subCategories && this.subCategories.length > 0) {
        try {
            // Get all categories that contain these subcategories
            const categories = await mongoose.model('Category').find({
                'subCategories._id': { $in: this.subCategories }
            });
            
            // Get all valid subcategory IDs from these categories
            const validSubCategories = categories.flatMap(cat => 
                cat.subCategories.map(sub => sub._id.toString())
            );
            
            // Check if all subcategories belong to the selected categories
            const allValid = this.subCategories.every(subId => {
                const subIdStr = subId.toString();
                return validSubCategories.includes(subIdStr) && 
                       this.categories.some(catId => 
                           categories.some(cat => cat._id.equals(catId))
                       );
            });
            
            if (!allValid) {
                this.invalidate('subCategories', 'One or more subcategories do not belong to the selected categories');
            }
        } catch (err) {
            this.invalidate('subCategories', 'Error validating subcategories');
        }
    }
    next();
});


module.exports = mongoose.model('Package', PackageSchema);