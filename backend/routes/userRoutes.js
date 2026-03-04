const express = require('express');
const router = express.Router();

// 🛡️ Middlewares
const { protect } = require('../middlewares/authMiddleware'); // NOTE: Make sure path matches your structure
const upload = require('../middlewares/uploadMiddleware');    // NOTE: Make sure path matches your structure

// 🎮 Controllers
const { 
    getUserProfile,
    getOtherUserProfile, 
    updateProfile,
    sendConnectionRequest, 
    acceptConnectionRequest, 
    rejectConnectionRequest,
    unconnectUser
} = require('../controllers/userController');

// ==========================================
// 👤 PROFILE ROUTES
// ==========================================
// Get current logged-in user's profile
router.get('/profile', protect, getUserProfile);

// Get OTHER user's profile by their ID 
router.get('/:id', protect, getOtherUserProfile);

// 👉 THE FIX: Update route par ab dono (image aur 3D model) accept honge
router.put('/update', protect, upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'avatar3D', maxCount: 1 }
]), updateProfile); 

// ==========================================
// 🤝 CONNECTION ROUTES
// ==========================================
// Send a new connection request
router.post('/connect/:id', protect, sendConnectionRequest);    

// Accept or Reject a pending request 
router.post('/:id/accept', protect, acceptConnectionRequest);
router.post('/:id/reject', protect, rejectConnectionRequest);

// Remove an existing connection (Unconnect)
router.post('/unconnect/:id', protect, unconnectUser);

module.exports = router;