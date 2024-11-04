import bcrypt from "bcrypt";
import { User } from "../models/user.js";
import { sendToken,cookieOptions, uploadFilesToCloudinary } from "../utils/features.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import { ErrorHandling } from "../utils/ErrorHandling.js";
import { Chat } from "../models/chat.js";
import { Request } from "../models/request.js";
import { NEW_REQUEST, REFETCH_DATA } from "../constants/events.js";
import { emitEvent } from "../utils/features.js";
import { getBase64, getOtherMember } from "../helpers/getOtherMember.js";




// Controller for creating a new user
const newUser = asyncHandler(async (req, res, next) => {
  const { name, username, password, bio } = req.body;
  const file = req.file;
   // For single file
  // `req.file` should be single file if using `multer.single()`

  if (!file) {
    return next(new ErrorHandling('Need to upload files', 400));
  }

  // Validate request body
  if (!name || !username || !password || !bio) {
    return next(new ErrorHandling('All fields are required', 400));
  }

 
    const result = await uploadFilesToCloudinary([file]);
   
    const avatar={
      public_id: result[0].public_id,
      url: result[0].url,
    }
   

    // Hash the password before saving
    // const hashedPassword = await hashPassword(password);

    // Create new user
    const user=await User.create({
      name,
      bio,
      username,
      password,
      avatar
    })
    
    sendToken(res,"User created",201,user)
 
});

// Controller for logging in a user
const login = asyncHandler(async (req, res, next) => {
  const { username, password } = req.body;

  // Validate request body
  if (!username || !password) {
    return next(new ErrorHandling("Username and password are required", 400));
  }

  // Find the user by username and include the password field
  const user = await User.findOne({ username }).select("+password");

  // Check if user exists
  if (!user) {
    return next(new ErrorHandling("Invalid username", 401));
  }

  // Log the stored hashed password for debugging
  console.log("Stored hashed password:", user.password);

  // Compare the password
  const isMatch = await bcrypt.compare(password, user.password);

  // Log the result of the password comparison
  console.log("Password match result:", isMatch);

  if (!isMatch) {
    return next(new ErrorHandling("Invalid password", 401));
  }

  // Send token if authentication is successful
  sendToken(res, `Welcome to user ${user._id}`, 200, user);
});

// Controller for getting user profile
const getProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user); // Corrected from req.user to req.user._id
  if (!user) {
    return next(new ErrorHandling("User not found", 404));
  }
  res.status(200).json({ success: true, user });
});

// Controller for logging out a user
const logOut = asyncHandler(async (req, res) => {
  res
    .status(200)
    .cookie("HassanCook", "", {
      ...cookieOptions,
      maxAge: 0, // Set the cookie to expire immediately
    })
    .json({ success: true, message: "Logged out successfully" });
});

const searchUser = asyncHandler(async (req, res) => {
  const { name } = req.query;

  const myChats = await Chat.find({ groupChat: false, members: req.user });
  const allUsersFromMyChat = myChats.flatMap((chat) => chat.members);

  const exceptFriendAndMe = await User.find({
    _id: { $nin: allUsersFromMyChat },
    name: { $regex: name, $options: "i" },
  });

  const users = exceptFriendAndMe.map(({ _id, name, avatar }) => ({
    _id,
    name,
    avatar: avatar.url,
  }));

  res.status(200).json({ success: true, users });
});


const sendRequest = asyncHandler(async (req, res, next) => {
  const { userId } = req.body;

  // Log sender and receiver for debugging
 

  try {
    // Check if a request already exists
    const request = await Request.findOne({
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id }
      ]
    });

    // If a request already exists, return an error
    if (request) return next(new ErrorHandling("Already sent request", 400));

    // Create a new request
    const newRequest=await Request.create({
      sender: req.user, // Use req.user._id as sender
      receiver: userId
    });
    console.log("Request created:", newRequest);

    // Emit event after request creation
    emitEvent(req, NEW_REQUEST, [userId]);

    res.status(200).json({ success: true, message: "Request sent successfully" });
  } catch (error) {
    console.error("Error sending request:", error);
    return next(new ErrorHandling("Internal Server Error"));
  }
});


const getMyNotifications=asyncHandler(async(req,res,next)=>{
 const requests=await Request.find({receiver:req.user}).populate("sender","name avatar")
 const allRequests=requests.map(({_id,sender})=>({
  _id,
  sender:{
    _id:sender._id,
    name:sender.name,
    avatar:sender.avatar.url
  }
 }))
 res.status(200).json({ success: true,allRequests});
})

const acceptRequest = asyncHandler(async (req, res, next) => {
  const { requestId, accept } = req.body;
  
  const request = await Request.findById(requestId)
    .populate("sender", "name")
    .populate("receiver", "name");

  console.log("Request Data:", request); // Log request data for debugging
  
  if (!request) {
    return next(new ErrorHandling("Request not found", 400));
  }

  if (request.receiver._id.toString() !== req.user.toString()) {
    return next(new ErrorHandling("You are not allowed to accept the request", 400));
  }

  if (!accept) {
    await Request.deleteOne({ _id: requestId });
    return res.status(200).json({ success: true, message: "Request Rejected" });
  }

  const members = [request.receiver._id, request.sender._id];
  
  await Promise.all([
    Chat.create({
      members,
      name: `${request.sender.name}--${request.receiver.name}`
    }),
    Request.deleteOne({ _id: requestId })
  ]);

  emitEvent(req, REFETCH_DATA, members);
  
  return res.status(200).json({ success: true, message: "Request Accepted" });
});

const myFriends = asyncHandler(async (req, res, next) => {
  const { chatId } = req.query; // Correct extraction of query parameter

  // Fetching all chats where the current user is a member and it's not a group chat
  const chats = await Chat.find({
    members: req.user,
    groupChat: false,
  }).populate("members", "name avatar");

  // Map through chats to get the list of friends
  const friends = chats.map(({ members }) => {
    const otherMember = getOtherMember(members, req.user);
    return {
      _id: otherMember._id,
      name: otherMember.name,
      avatar: otherMember.avatar.url,
    };
  });

  // Check if a chatId is provided
  if (chatId) {
    const chat = await Chat.findById(chatId);

    if (!chat) {
      return next(new ErrorHandling("Chat not found", 404));
    }

    const availableFriends = friends.filter(
      (friend) => !chat.members.includes(friend._id.toString())
    );

    return res.status(200).json({ success: true, availableFriends });
  } else {
    return res.status(200).json({ success: true, friends });
  }
});

export { newUser, login, getProfile, logOut ,searchUser,sendRequest,myFriends,getMyNotifications,acceptRequest};
