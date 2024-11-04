import { HASSAN_TOKEN } from "../constants/events.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import { Chat } from "../models/chat.js";
import { Message } from "../models/message.js";
import { User } from "../models/user.js";
import { ErrorHandling } from "../utils/ErrorHandling.js";
import { cookieOptions } from "../utils/features.js";
import jwt from 'jsonwebtoken';


const adminLogin = asyncHandler(async (req, res, next) => {
    const { secretKey } = req.body;
    const adminSecretKey = process.env.ADMIN_SECRETKEY || "hehehe";

    // Compare provided secretKey to expected admin secretKey
   // if (secretKey !== adminSecretKey) {
     //   return next(new ErrorHandling("Admin is not authorized", 401));
    //}

    // Generate a JWT with the admin secret key included in the payload
    const token = jwt.sign( secretKey, process.env.JWT_SECRETKEY);

    // Set token as a cookie in the response
    res.status(200).cookie(HASSAN_TOKEN, token, {
        ...cookieOptions,
        maxAge: 1000 * 60 * 60// Expires in 15 minutes
    }).json({
        success: true,
        message: "Admin login successfully"
    });
});

const allUsers = asyncHandler(async (req, res, next) => {
    const users = await User.find({});
    
    // Use Promise.all to handle asynchronous mapping
    const transformUsers = await Promise.all(users.map(async ({ name, username, avatar, _id }) => {
        const [groups, friends] = await Promise.all([
            Chat.countDocuments({ groupChat: true, members: _id }),
            Chat.countDocuments({ groupChat: false, members: _id })
        ]);

        return {
            name,
            username,
            avatar: avatar.url,
            _id,
            groups,
            friends
        };
    }));

    // Return the transformed users as the response
    res.status(200).json({ success: true, users: transformUsers });
});

const allChats=asyncHandler(async(req,res,next)=>{
    const chats = await Chat.find({})
            .populate("members", "name avatar")
            .populate("creator", "name avatar");

        const transformedChats = await Promise.all(
            chats.map(async (chat) => {
                const totalMessages = await Message.countDocuments({ chat: chat._id });

                return {
                    _id: chat._id,
                    name: chat.name,
                    groupChat: chat.groupChat,
                    avatar: chat.members.slice(0, 3).map((member) => member.avatar.url),
                    members: chat.members.map((member) => ({
                        _id: member._id,
                        name: member.name,
                        avatar: member.avatar.url
                    })),
                    creator: {
                        name: chat.creator?.name || "None",
                        avatar: chat.creator?.avatar.url || ""
                    },
                    totalMembers: chat.members.length,
                    totalMessages
                };
            })
        );

        res.status(200).json({success:true,transformedChats});
})

const allMessages=asyncHandler(async(req,res,next)=>{
    const messages = await Message.find({})
            .populate("chat", "groupChat")
            .populate("sender", "name avatar");

        const transformedMessages = messages.map((message) => {
            // Destructure with default values to avoid errors
            const {
                _id,
                sender = {}, // Default to an empty object if undefined
                content,
                attachments,
                createdAt,
                chat = {},  // Default to an empty object if undefined
            } = message;

        
            return {
                _id,
                content,
                attachments,
                createdAt,
                chat: chat._id || "Chat ID not available",  // Fallback in case chat._id is undefined
                groupChat: chat.groupChat || false, // Fallback in case chat.groupChat is undefined
                sender: {
                    _id: sender._id || "Sender ID not available",  // Fallback in case sender._id is undefined
                    name: sender.name || "Unknown",  // Fallback in case sender.name is undefined
                    avatar: sender.avatar?.url || "No avatar",  // Fallback in case avatar is undefined
                },
            };
        });

        res.status(200).json({
            success: true,
            messages: transformedMessages,
        });
})

const dashboardStats = asyncHandler(async (req, res) => {
    const [groupsCount, userCount, messagesCount, chatCount] = await Promise.all([
        Chat.countDocuments({ groupChat: true }),
        User.countDocuments(),
        Message.countDocuments(),
        Chat.countDocuments()
    ]);

   

    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const lastSevenDayMessages = await Message.find({
        createdAt: {
            $gte: sevenDaysAgo,
            $lte: today
        }
    }).select("createdAt");

    const messages = new Array(7).fill(0);
    const dayInMilliseconds = 1000 * 60 * 60 * 24;

    lastSevenDayMessages.forEach((message) => {
        const indexApprox = (today.getTime() - message.createdAt.getTime()) / dayInMilliseconds;
        const index = Math.floor(indexApprox);
        if (index >= 0 && index < 7) {
            messages[6 - index]++;
        }
    });
    const stats = { groupsCount, userCount, messagesCount, chatCount,messagesChart: messages };

    res.status(200).json({
        success: true,
        stats
        
    });
});



const adminLogout= asyncHandler(async (req, res, next) => {
    

    // Set the token as a cookie in the response
    res.status(200).cookie("-token", "", {
        ...cookieOptions,
        maxAge: 0 // cookie expires in 15 minutes
    }).json({
        success: true,
        message: "Admin logout successfully"
    });
   
});

const getAdminData = asyncHandler(async (req, res, next) => {
    const [groupsCount, userCount, messagesCount, chatCount] = await Promise.all([
        Chat.countDocuments({ groupChat: true }),
        User.countDocuments(),
        Message.countDocuments(),
        Chat.countDocuments()
    ]);

    const recentMessages = await Message.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("sender", "name avatar")
        .populate("chat", "name groupChat");

    const adminData = {
        stats: {
            groupsCount,
            userCount,
            messagesCount,
            chatCount,
        },
        recentMessages: recentMessages.map((msg) => ({
            _id: msg._id,
            content: msg.content,
            sender: {
                name: msg.sender.name,
                avatar: msg.sender.avatar?.url || "No avatar",
            },
            chat: {
                name: msg.chat.name,
                groupChat: msg.chat.groupChat,
            },
            createdAt: msg.createdAt,
        })),
    };

    res.status(200).json({ success: true, adminData });
});



export {allUsers,allChats,allMessages,dashboardStats,adminLogin,adminLogout,getAdminData}