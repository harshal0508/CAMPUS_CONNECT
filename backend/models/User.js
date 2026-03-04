const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    googleId: { 
        type: String, 
        required: false 
    },
    avatar: { 
        type: String,
        default: '' // 👉 Good practice: Default empty string rakhein
    },
    // 👉 NAYA FIELD: 3D model link save karne ke liye!
    avatar3D: { 
        type: String, 
        default: '' 
    },
    handle: { 
        type: String, 
        required: true, 
        unique: true,
        lowercase: true, // 👉 Good practice: Handle hamesha lowercase mein rakhein
        trim: true       // 👉 Spaces hata dega
    },
    role: {
        type: String,
        enum: ['student', 'alumni', 'admin'],
        default: 'student'
    },
    bio: { 
        type: String, 
        maxLength: 160 
    },
    dept: { 
        type: String 
    },
    batch: { 
        type: String, 
        default: "" 
    },
    github: { 
        type: String, 
        default: "" 
    },
    skills: { 
        type: [String], 
        default: [] 
    },
    interests: { 
        type: [String], 
        default: [] 
    },

    // 🚀 GENZ STATS (FOR GAMIFIED EXPERIENCE)
    streak: { 
        type: Number, 
        default: 0 
    },
    hearts: { 
        type: Number, 
        default: 0 
    },
    badgesCount: { 
        type: Number, 
        default: 0 
    },

    // 🌐 NETWORKING & CONNECTIONS
    connections: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    pendingRequests: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    sentRequests: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }]

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);