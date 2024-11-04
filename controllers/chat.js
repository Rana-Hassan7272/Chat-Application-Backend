import { ALERT, ATTACHMENT_MESSAGE, NEW_MESSAGE, NEW_MESSAGE_ALERT, REFETCH_DATA } from "../constants/events.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import { ErrorHandling } from "../utils/ErrorHandling.js";
import { deleteFromCloudinary, emitEvent, uploadFilesToCloudinary } from "../utils/features.js";
import { Chat } from "../models/chat.js";
import { User } from "../models/user.js";
import { getOtherMember } from "../helpers/getOtherMember.js";
import { Message } from "../models/message.js";


/**
 * Creates a new chat group.
 */
const newChatGroup = asyncHandler(async (req, res, next) => {
  const { name, members } = req.body;

  // Validate input
  if (!name || !Array.isArray(members)) {
    return next(new ErrorHandling("Invalid input data", 400));
  }

  // Ensure the group has at least 3 members including the logged-in user
  const allMembers = [...new Set([...members.map(id => id.toString()), req.user.toString()])]; // Ensure uniqueness and convert to strings

  // Create the chat group
  const chat = await Chat.create({
    name,
    groupChat: true,
    members: allMembers,
    creator: req.user,
  });

  // Emit events and respond
  emitEvent(req, ALERT, chat, `Welcome to ${name}`);
  emitEvent(req, REFETCH_DATA, allMembers);

  res.status(200).json({ success: true, message: "Group created successfully" });
});

/**
 * Retrieves chats that the user is a member of.
 */
const getMyChat = asyncHandler(async (req, res, next) => {
  // Find chats that the user is a member of
  const chats = await Chat.find({ members: req.user }).populate("members", "name avatar username");

  // Transform the chat data
  const transformedChats = chats.map(chat => {
    const otherMembers = getOtherMember(chat.members, req.user);
    const transformedChat = {
      _id: chat._id.toString(),
      groupChat: chat.groupChat,
      avatar: chat.groupChat 
        ? chat.members.slice(0, 3).map(member => member.avatar.url) 
        : [otherMembers.avatar.url],
      name: chat.groupChat ? chat.name : otherMembers.name,
      members: chat.members.reduce((prev, curr) => {
        if (curr._id.toString() !== req.user) {
          prev.push(curr._id.toString());
        }
        return prev;
      }, []),
    };
    return transformedChat;
  });

  res.status(200).json({ success: true, chats: transformedChats });
});

/**
 * Retrieves groups where the user is the creator.
 */
const getMyGroup = asyncHandler(async (req, res, next) => {
  const chats = await Chat.find({ members: req.user, groupChat: true, creator: req.user })
    .populate("members", "name avatar");
  
  const groups = chats.map(({ members, groupChat, name, _id }) => ({
    groupChat,
    name,
    _id: _id.toString(),
    avatar: members.slice(0, 3).map(member => member.avatar.url),
  }));

  res.status(200).json({ success: true, groups });
});

/**
 * Adds new members to a group chat.
 */
const addMembers = asyncHandler(async (req, res, next) => {
  const { chatId, members } = req.body;

  // Validate input
  if (!chatId || !Array.isArray(members)) {
    return next(new ErrorHandling("Invalid input data", 400));
  }

  

  // Find the chat by ID
  const chat = await Chat.findById(chatId);

  // Check if the chat exists
  if (!chat) {
    return next(new ErrorHandling("Chat ID not found", 404));
  }

  // Check if the chat is a group chat
  if (!chat.groupChat) {
    return next(new ErrorHandling("Group not found", 401));
  }

  // Find all new members
  const allNewMembersPromise = members.map(_id => User.findById(_id, "username"));
  const allNewMembers = await Promise.all(allNewMembersPromise);
  
  // Filter out undefined users (invalid user IDs) and already existing members
  const uniqueMembers = allNewMembers
    .filter(user => user && !chat.members.map(member => member.toString()).includes(user._id.toString()))
    .map(user => user._id.toString());

  // Add new members' IDs to the chat
  chat.members.push(...uniqueMembers);

  // Check if the members limit is exceeded
  if (chat.members.length > 100) {
    return next(new ErrorHandling("Members limit reached", 400));
  }

  // Save the updated chat
  await chat.save();
  
  // Compile usernames of new members for the welcome message
  const allUserName = allNewMembers
    .filter(user => user)
    .map(user => user.username)
    .join(", ");

  emitEvent(req, ALERT, chat.members, `Welcome ${allUserName} to the group`);
  emitEvent(req, REFETCH_DATA, chat.members);

  // Respond with success
  res.status(200).json({ success: true, message: "Members added successfully" });
});

/**
 * Removes a member from a group chat.
 */
const removeMembers = asyncHandler(async (req, res, next) => {
  const { userId, chatId } = req.body;

  // Validate input
  if (!chatId || !userId) {
    return next(new ErrorHandling("Chat ID and User ID are required", 400));
  }



  // Use await with Promise.all to resolve the promises
  const [chat, userThatRemove] = await Promise.all([
    Chat.findById(chatId),
    User.findById(userId)
  ]);

  // Check if the chat exists
  if (!chat) {
    return next(new ErrorHandling("Chat ID not found", 404));
  }

  // Check if the chat is a group chat
  if (!chat.groupChat) {
    return next(new ErrorHandling("Group not found", 401));
  }

  // Check if the user to remove exists
  if (!userThatRemove) {
    return next(new ErrorHandling("User not found", 404));
  }

  // Ensure the chat has at least 3 members after removal
  const updatedMembers = chat.members.filter(member => member.toString() !== userId);
  if (updatedMembers.length < 3) {
    return next(new ErrorHandling("Group must have at least 3 members", 400));
  }

  // Remove the member
  chat.members = updatedMembers;

  // Save the updated chat
  await chat.save();

  // Emit events
  emitEvent(req, ALERT, chat.members.map(id => id.toString()), `Member ${userThatRemove.username} has been removed from the group`);
  emitEvent(req, REFETCH_DATA, chat.members.map(id => id.toString()));

  // Respond with success
  res.status(200).json({ success: true, message: "Member removed successfully" });
});

/**
 * Allows a user to leave a group chat.
 */
const leaveMember = asyncHandler(async (req, res, next) => {
  const chatId = req.params.id;


  const chat = await Chat.findById(chatId);
  if (!chat) {
    return next(new ErrorHandling("Chat ID not found", 404));
  }

  // Check if the chat is a group chat
  if (!chat.groupChat) {
    return next(new ErrorHandling("Group not found", 401));
  }

  // Filter out the member leaving the group
  const chatMembers = chat.members.filter(member => member.toString() !== req.user);
  
  // Ensure the chat has at least 3 members after removal
  if (chatMembers.length < 3) {
    return next(new ErrorHandling("Group must have at least 3 members", 400));
  }

  // Reassign the creator if the creator is leaving
  if (chat.creator.toString() === req.user) {
    const randomIndex = Math.floor(Math.random() * chatMembers.length);
    const newCreator = chatMembers[randomIndex];
    chat.creator = newCreator;
  }

  chat.members = chatMembers;

  // Fetch the username of the user leaving
  const [user] = await Promise.all([
    User.findById(req.user, "username"),
    chat.save()
  ]);

  // Emit events
  emitEvent(req, ALERT, chat.members.map(id => id.toString()), `User ${user.username} has left the group`);
  emitEvent(req, REFETCH_DATA, chat.members.map(id => id.toString()));

  // Respond with success
  res.status(200).json({ success: true, message: "Left group successfully" });
});

/**
 * Sends attachments in a chat.
 */
const sendAttachments = asyncHandler(async (req, res, next) => {
  const { chatId } = req.body;
  const files = req.files || [];

  if (files.length < 1) {
    return next(new ErrorHandling("Need to upload files", 400));
  }

  console.log('Uploaded Files:', req.files);

  // Check if chat ID is provided
  if (!chatId) {
    return next(new ErrorHandling("Chat ID is required", 400));
  }


  // Fetch chat and user information
  const [chat, me] = await Promise.all([
    Chat.findById(chatId),
    User.findById(req.user, "name")
  ]);

  // Check if chat exists
  if (!chat) {
    return next(new ErrorHandling("Chat ID not found", 404));
  }

  // Check if the user is a member of the chat
  const isMember = chat.members.some(member => member.toString() === req.user);
  if (!isMember) {
    console.warn(`User ${req.user} attempted to send attachments to chat ${chatId} without membership`);
    return next(new ErrorHandling("Not allowed to send attachments", 403));
  }

  // Process and store attachments
  const attachments = await uploadFilesToCloudinary(files);

  // Create message object to save in the database
  const messageToDb = {
    content: "",
    attachments,
    chat: chatId,
    sender: me._id
  };

  // Save the message to the database
  const message = await Message.create(messageToDb);

  // Prepare message object to return in the response
  const messageForReal = {
    content: message.content, // Use actual content
    attachments,
    chat: chatId,
    sender: {
      _id: me._id.toString(),
      name: me.name
    }
  };

  emitEvent(req, NEW_MESSAGE, chat.members.map(id => id.toString()), { chatId, message: messageForReal });
  emitEvent(req, NEW_MESSAGE_ALERT, chat.members.map(id => id.toString()), { chatId });

  // Send success response
  res.status(200).json({
    success: true,
    message: "Attachments sent successfully",
    data: message
  });
});

/**
 * Retrieves detailed information about a chat, with optional population of members.
 */
const getMessages = asyncHandler(async (req, res, next) => {
  if (req.query.populate === "true") {
    const chatId=req.params.id;
    const chat = await Chat.findById(chatId)
      .populate("members", "name avatar")
      .lean();

    if (!chat) return next(new ErrorHandler("Chat not found", 404));

    chat.members = chat.members.map(({ _id, name, avatar }) => ({
      _id,
      name,
      avatar: avatar.url,
    }));
   
    return res.status(200).json({
      success: true,
      chat,
    });
  } else {
    const chatId=req.params.id
    const chat = await Chat.findById(chatId);
    if (!chat) return next(new ErrorHandler("Chat not found", 404));
   
    return res.status(200).json({
      success: true,
      chat,
    });
  }
});


/**
 * Renames a group chat.
 */
const renameGroup = asyncHandler(async(req, res, next) => {
   const chatId = req.params.id;
   const { name } = req.body;

   // Validate input
   if (!name) {
     return next(new ErrorHandling("New name is required", 400));
   }


   const chat = await Chat.findById(chatId);
   if (!chat) {
     return next(new ErrorHandling("Chat ID not found", 404));
   }

   // Check if the chat is a group chat
   if (!chat.groupChat) {
     return next(new ErrorHandling("Group not found", 401));
   }

   // Check if the current user is the creator
   if(chat.creator.toString() !== req.user){
     console.warn(`User ${req.user} attempted to rename group ${chatId} without permission`);
     return next(new ErrorHandling("You are not allowed to change name", 403));
   }

   // Update the group name
   chat.name = name;
   await chat.save();

   emitEvent(req, REFETCH_DATA, chat.members.map(id => id.toString()));
   res.status(200).json({
     success: true,
     message:"Renamed group successfully"
   });
});

/**
 * Deletes a chat or group chat.
 */
const deleteChat = asyncHandler(async(req, res, next) => {
  const chatId = req.params.id;


  const chat = await Chat.findById(chatId);
  if (!chat) {
    return next(new ErrorHandling("Chat ID not found", 404));
  }

  // Check permissions
  if(chat.groupChat){
    if(chat.creator.toString() !== req.user){
      console.warn(`User ${req.user} attempted to delete group ${chatId} without permission`);
      return next(new ErrorHandling("You are not allowed to delete this group", 403));
    }
  }
  else{
    // For one-on-one chats, check if the user is a member
    if(!chat.members.some(member => member.toString() === req.user)){
      console.warn(`User ${req.user} attempted to delete chat ${chatId} without being a member`);
      return next(new ErrorHandling("You are not allowed to delete this chat", 403));
    }
  }

  // Fetch messages with attachments
  const messageWithAttachments = await Message.find({
    chat: chatId,
    attachments: { $exists: true, $ne: [] }
  });

  const public_ids = [];
  messageWithAttachments.forEach(({ attachments }) => {
    attachments.forEach(({ attachment }) => {
      public_ids.push(attachment.public_id);
    });
  });

  try {
    await Promise.all([
      deleteFromCloudinary(public_ids),
      chat.deleteOne(),
      Message.deleteMany({ chat: chatId })
    ]);
  } catch (error) {
    console.error(`Error deleting chat ${chatId}:`, error);
    return next(new ErrorHandling("Failed to delete chat", 500));
  }

  // Emit events
  emitEvent(req, REFETCH_DATA, chat.members.map(id => id.toString()));
  res.status(200).json({
    success: true,
    message:"Chat deleted successfully"
  });
});

/**
 * Retrieves paginated messages for a chat.
 */
const getChatMessages = asyncHandler(async (req, res, next) => {
  const chatId = req.params.id;



  const chat = await Chat.findById(chatId);
  if (!chat) {
    console.warn(`Chat ID not found: ${chatId}`);
    return next(new ErrorHandling("Not allowed to message", 404));
  }

  // Check if the user is a member of the chat
  if (!chat.members.some(member => member.toString() === req.user)) {
    console.warn(`User ${req.user} attempted to access messages for chat ${chatId} without membership`);
    return next(new ErrorHandling("Not allowed to message", 403));
  }

  const { page = 1 } = req.query;
  const perPage = 20;
  const skip = (page - 1) * perPage;

  try {
    const [messages, totalMessages] = await Promise.all([
      Message.find({ chat: chatId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(perPage)
        .populate("sender", "name")
        .lean(),
      Message.countDocuments({ chat: chatId })
    ]);
   

    const totalPages = Math.ceil(totalMessages / perPage);
   
    res.status(200).json({
      success: true,
      messages: messages.reverse(),
      totalPages
    });
  } catch (error) {
    console.error(`Error fetching messages for chat ${chatId}:`, error);
    return next(new ErrorHandling("Failed to fetch messages", 500));
  }
});

export { 
  newChatGroup, 
  getMyChat,
  getMyGroup,
  addMembers,
  removeMembers,
  leaveMember,
  sendAttachments,
  getMessages,
  renameGroup,
  deleteChat,
  getChatMessages
};
