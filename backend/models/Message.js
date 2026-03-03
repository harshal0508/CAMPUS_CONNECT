const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Jo user message bhej raha hai
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Jisko message bheja ja raha hai
    required: true
  },
  content: {
    type: String,
    required: true
  }
}, { timestamps: true }); // timestamps true rakhne se createdAt apne aap ban jayega

// compound index :jab hum sender aur receiver dono ke hisaab se messages dhoondhte hain
messageSchema.index({send :1 , receiver : 1}) ;

// SORT INDEX
messageSchema.index({createdAt : 1 })

module.exports = mongoose.model('Message', messageSchema);
