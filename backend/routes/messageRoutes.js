const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// 👉 Aapka verify kiya hua middleware yahan import ho raha hai
const { protect } = require('../middlewares/authMiddleware');

// 🟢 GET: Puraani chat history nikalna (Protected)
router.get('/:friendId', protect, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: req.params.friendId },
        { sender: req.params.friendId, receiver: req.user._id }
      ]
    }).sort('createdAt'); // Puraane se naye ki taraf sort karein
    
    res.json(messages);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// 🟢 POST: Naya message database mein save karna (Protected)
router.post('/', protect, async (req, res) => {
  const { receiverId, content } = req.body;
  
  if (!receiverId || !content) {
    return res.status(400).json({ message: "Receiver ID and content are required" });
  }

  try {
    const newMessage = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      content: content
    });
    
    // Sender ki thodi details populate karke return karein
    const populatedMessage = await newMessage.populate('sender', 'name avatar');
    res.status(201).json(populatedMessage);
  } catch (err) {
    console.error("Error saving message:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;