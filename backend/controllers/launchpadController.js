const Launchpad = require('../models/launchpad');
const User = require('../models/User');

// @desc    Deploy a new project node
// @route   POST /api/launchpad
// @access  Private
const createProject = async (req, res) => {
    try {
        const { title, tagline, description, category, tags, github, liveLink, hiring } = req.body;

        const newProject = await Launchpad.create({
            title,
            tagline,
            description,
            category,
            founder: req.user._id,
            team: [{ user: req.user._id, role: 'Founder' }],
            tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
            github,
            liveLink,
            hiring
        });

        const populatedProject = await newProject.populate('team.user', 'name handle avatar');
        res.status(201).json(populatedProject);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all campus projects
// @route   GET /api/launchpad
// @access  Private
const getProjects = async (req, res) => {
    try {
        const projects = await Launchpad.find()
            .populate('team.user', 'name handle avatar')
            .populate('founder', 'name handle avatar')
            .sort({ createdAt: -1 });

        res.status(200).json(projects);
    } catch (error) {
        res.status(500).json({ message: "Failed to sync campus nodes" });
    }
};

// @desc    Toggle upvote on a project
// @route   PATCH /api/launchpad/:id/upvote
// @access  Private
const toggleUpvote = async (req, res) => {
    try {
        const project = await Launchpad.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const isUpvoted = project.upvotes.includes(req.user._id);

        if (isUpvoted) {
            project.upvotes = project.upvotes.filter(id => id.toString() !== req.user._id.toString());
        } else {
            project.upvotes.push(req.user._id);
        }

        await project.save();
        res.status(200).json({ upvotes: project.upvotes.length, hasUpvoted: !isUpvoted });
    } catch (error) {
        res.status(500).json({ message: "Upvote action failed" });
    }
};

// @desc    Invest V-Tokens in a project (With Real Deduction)
// @route   POST /api/launchpad/:id/invest
// @access  Private
const investInProject = async (req, res) => {
    try {
        const { amount } = req.body;
        const projectId = req.params.id;

        if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

        // 1. Check user balance
        const user = await User.findById(req.user._id);
        if (user.vTokens < amount) {
            return res.status(400).json({ message: "Balance kam hai bhai! 💸" });
        }

        // 2. Transact: Deduct from User, Add to Project
        await User.findByIdAndUpdate(req.user._id, { $inc: { vTokens: -amount } });
        
        const project = await Launchpad.findByIdAndUpdate(
            projectId,
            { $inc: { tokensRaised: amount } },
            { new: true }
        );

        res.status(200).json({ 
            message: `Successfully invested ${amount} VT`,
            totalRaised: project.tokensRaised,
            remainingBalance: user.vTokens - amount
        });
    } catch (error) {
        res.status(500).json({ message: "Transaction failed" });
    }
};

// @desc    Add member to squad
// @route   POST /api/launchpad/:id/squad/add
const addSquadMember = async (req, res) => {
    try {
        const { userId, role } = req.body;
        const project = await Launchpad.findById(req.params.id);

        if (!project) return res.status(404).json({ message: "Not found" });
        if (project.founder.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        project.team.push({ user: userId, role: role || 'Contributor' });
        await project.save();

        const updated = await project.populate('team.user', 'name handle avatar');
        res.status(200).json(updated);
    } catch (error) {
        res.status(500).json({ message: "Failed to add member" });
    }
};

// @desc    Delete project node
// @route   DELETE /api/launchpad/:id
const deleteProject = async (req, res) => {
    try {
        const project = await Launchpad.findById(req.params.id);
        if (!project) return res.status(404).json({ message: "Not found" });

        if (project.founder.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        await project.deleteOne();
        res.status(200).json({ message: "Project deleted" });
    } catch (error) {
        res.status(500).json({ message: "Delete failed" });
    }
};

module.exports = {
    createProject,
    getProjects,
    toggleUpvote,
    investInProject,
    addSquadMember,
    deleteProject
};