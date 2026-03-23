const express = require('express');
const router = express.Router();
const { 
    createProject, 
    getProjects, 
    toggleUpvote, 
    investInProject,
    addSquadMember, // 👉 Top import fix
    deleteProject   // 👉 Top import fix
} = require('../controllers/launchpadController');
const { protect } = require('../middlewares/authMiddleware');

/**
 * 🚀 LAUNCHPAD ROUTING
 * Base Path: /api/launchpad
 */

// 1. Saare projects fetch karna aur naya project deploy karna
router.route('/')
    .get(protect, getProjects)
    .post(protect, createProject);

// 2. Engagement logic (Upvotes & Investment)
router.patch('/:id/upvote', protect, toggleUpvote);
router.post('/:id/invest', protect, investInProject);

// 3. Squad & Node Management
// Naya banda team mein add karne ke liye
router.post('/:id/squad/add', protect, addSquadMember); 

// Project ko delete/archive karne ke liye
router.delete('/:id', protect, deleteProject); 

module.exports = router;