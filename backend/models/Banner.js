const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: false,
        trim: true
    },
    images: {
        type: [{
            url: { 
                type: String, 
                required: true 
            },
        }],
        validate: {
            validator: function(array) {
                return array.length >= 1 && array.length <= 5;
            },
            message: 'A banner must have between 1 and 5 images'
        },
        required: true
    },
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

module.exports = mongoose.model('Banner', BannerSchema);