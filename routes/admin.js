import express from "express";
import { adminLogin, adminLogout, allChats, allMessages, allUsers, dashboardStats, getAdminData } from "../controllers/admin.js";
import { adminVerify, isAuthenticated } from "../middlewares/isAuthenticated.js";
import { addMembers, deleteChat, getMessages, getMyChat, getMyGroup, leaveMember, newChatGroup, removeMembers, renameGroup } from "../controllers/chat.js";
import {  adminVerification, validationHandler } from "../middlewares/validator.js";

const app=express.Router();


app.post("/verify", adminVerification(), validationHandler, adminLogin);
app.get("/logout", adminLogout);

app.use(adminVerify)
app.get("/",getAdminData)
app.get("/users", allUsers);
app.get("/chats", allChats);
app.get("/messages", allMessages);
app.get("/stats", dashboardStats);



export default app