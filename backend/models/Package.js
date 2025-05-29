const mongoose = require('mongoose');

const PackageSchema = new mongoose.Schema({
    title: { type: String, required: true },
    destination: { type: String, required: true },
    category: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Category', 
        required: true 
    },
    subCategory: { 
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        validate: {
            validator: async function(value) {
                if (!value) return true;
                const category = await mongoose.model('Category').findOne({
                    _id: this.category,
                    'subCategories._id': value
                });
                return !!category;
            },
            message: 'Subcategory does not belong to the selected category'
        }
    },
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


module.exports = mongoose.model('Package', PackageSchema);