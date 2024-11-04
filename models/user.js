import mongoose, { Schema, model } from 'mongoose';
import {hash} from 'bcrypt';

// Define the schema for the User model
const schema = new Schema({
 name: {
    type: String,
    required: true
  },
  bio: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true,
     // Exclude from query results by default
  },
  avatar: {
    public_id: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    }
  }
}, {
  timestamps: true  // Add createdAt and updatedAt timestamps
});

// Hash the password before saving the user
schema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await hash(this.password, 10);
  
});

// Export the User model, or create it if it doesn't already exist
export const User = mongoose.models.User || model('User', schema);
