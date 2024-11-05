import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import { createServer } from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import userRoute from './routes/user.js';
import chatRoute from './routes/chat.js';
import adminRoute from './routes/admin.js';

import errorMiddleware from './middlewares/error.js';
import { CHAT_EXIT, CHAT_JOIN, NEW_MESSAGE, NEW_MESSAGE_ALERT, ONLINE_USER, START_TYPING, STOP_TYPING } from './constants/events.js';
import { v4 as uuid } from 'uuid';
import { getSockets } from './helpers/getOtherMember.js';
import { Message } from './models/message.js';
import { v2 as cloudinary } from 'cloudinary';
import { socketAuthentication } from './middlewares/isAuthenticated.js';

dotenv.config({ path: './.env' });
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
});

const app = express();
const server = createServer(app);
const onlineUser = new Set();
const io = new Server(server, {
  cors: {
    origin: [process.env.CLIENT_URL, "http://localhost:4173","http://localhost:5173", "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});
app.set("io", io);

// Middleware
app.use(cors({
  origin: [process.env.CLIENT_URL, "http://localhost:4173", "http://localhost:3000","http://localhost:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use('/api/v1/user', userRoute);
app.use('/api/v1/chat', chatRoute);
app.use('/api/v1/admin', adminRoute);

// Error handling middleware
app.use(errorMiddleware);

// MongoDB Connection
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  throw new Error('MONGO_URI is not defined in the environment variables');
}

mongoose.connect(mongoUri)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Socket.IO Logic
const socketUserMap = new Map();
io.use((socket, next) => {
  cookieParser()(socket.request, socket.request.res, async (err) => {
    await socketAuthentication(socket, err, next);
  });
});

io.on('connection', (socket) => {
  const user = socket.user;

  // Store user socket ID
  socketUserMap.set(user._id.toString(), socket.id);

  // Event listeners
  socket.on(START_TYPING, async ({ members, chatId }) => {
    const socketMembers = getSockets(members);
    io.to(socketMembers).emit(START_TYPING, { chatId });
  });

  socket.on(STOP_TYPING, async ({ chatId, members }) => {
    const socketMembers = getSockets(members);
    io.to(socketMembers).emit(STOP_TYPING, { chatId });
  });

  socket.on(NEW_MESSAGE, async ({ chatId, members, message }) => {
    const messageForRealTime = {
      content: message,
      _id: uuid(),
      sender: {
        _id: user._id,
        name: user.name,
      },
      chat: chatId,
      createdAt: new Date().toISOString(),
    };

    const messageForDB = {
      content: message,
      sender: user._id,
      chat: chatId,
    };

    const membersSocket = getSockets(members);
    io.to(membersSocket).emit(NEW_MESSAGE, {
      chatId,
      message: messageForRealTime,
    });
    io.to(membersSocket).emit(NEW_MESSAGE_ALERT, { chatId });

    try {
      await Message.create(messageForDB);
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });

  socket.on(CHAT_JOIN, ({ userId, members }) => {
    onlineUser.add(userId.toString());
    const membersSocket = getSockets(members);
    io.to(membersSocket).emit(ONLINE_USER, Array.from(onlineUser));
  });

  socket.on(CHAT_EXIT, ({ userId, members }) => {
    onlineUser.delete(userId.toString());
    const membersSocket = getSockets(members);
    io.to(membersSocket).emit(ONLINE_USER, Array.from(onlineUser));
  });

  socket.on('disconnect', () => {
    socketUserMap.delete(user._id.toString());
    onlineUser.delete(user._id.toString());
    socket.broadcast.emit(ONLINE_USER, Array.from(onlineUser));
  });
});

// Start server
const PORT = process.env.SERVER_PORT || 3000;
const MODE = process.env.NODE_ENV?.trim() || 'Production';
const adminSecretKey = process.env.ADMIN_SECRETKEY || "adsasdsdfsdfsdfd";

server.listen(PORT, () => {
  console.log(`App is listening on port ${PORT} in ${MODE} mode`);
});

export { MODE, socketUserMap ,adminSecretKey};

