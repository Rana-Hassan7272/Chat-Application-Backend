import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import {v2 as cloudinary} from 'cloudinary'
import {v4 as uuid} from 'uuid'
import { getBase64, getSockets } from '../helpers/getOtherMember.js';
import { resolve } from 'path';

const cookieOptions = {
  sameSite: 'none',
  httpOnly: true,
  maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days in milliseconds
  secure:true// Set to true if your app is served over HTTPS
};


const connectDb = async (uri) => {
  try {
    const data = await mongoose.connect(uri, { dbName: 'HassanChat' });
    console.log(`Connected to ${data.connection.host}`);
  } catch (err) {
    console.error('Error connecting to the database:', err);
    throw err;
  }
};

const sendToken = (res, message, code, user) => {
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRETKEY);
  return res.status(code)
    .cookie('HassanCook', token, cookieOptions)
    .json({
      success: true,
      message,
      user
    });
};
const emitEvent=(req,event,users,data)=>{
  const io=req.app.get("io")
  const socketMembers = getSockets(users);
  io.to(socketMembers).emit(event,data)
  

}

const uploadFilesToCloudinary = async (files = []) => {
  if (files.length === 0) {
    throw new Error('No files provided');
  }

  const uploadPromises = files.map((file) =>
    new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        getBase64(file),
        {
          resource_type: 'auto',
          public_id: uuid(),
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            return reject(error);
          }
          resolve(result);
        }
      );
    })
  );

  try {
    const results = await Promise.all(uploadPromises);
    return results.map((result) => ({
      public_id: result.public_id,
      url: result.secure_url,
    }));
  } catch (err) {
    throw new Error(`Error in uploading files: ${err.message}`);
  }
};
const deleteFromCloudinary = async (public_ids) => {
  // Placeholder for cloudinary deletion logic
};


export { connectDb, sendToken,cookieOptions ,emitEvent,deleteFromCloudinary,uploadFilesToCloudinary};
