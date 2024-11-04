import express from "express";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import { files } from "../middlewares/multer.js";
import { sendAttachments } from "../controllers/chat.js";
import { addMembers, deleteChat, getMessages, getMyChat,getChatMessages, getMyGroup, leaveMember, newChatGroup, removeMembers, renameGroup } from "../controllers/chat.js";
import {attachmentsValidator, addMembersValidator, leaveMembersValidator, newGroupValidator, removeMembersValidator, renameValidator, validationHandler } from "../middlewares/validator.js";
const app=express.Router();

app.use(isAuthenticated)
app.post("/new",newGroupValidator(),validationHandler,newChatGroup)
app.get("/my",getMyChat)
app.get("/my/group",getMyGroup)
app.put("/addMembers",addMembersValidator(),validationHandler,addMembers)
app.put("/removeMembers",removeMembersValidator,validationHandler,removeMembers)
app.delete("/leaveMember/:id",leaveMembersValidator(),validationHandler,leaveMember)


app.post("/message",files,sendAttachments)
app.get("/message/:id",getChatMessages)
app.post("/attachments",files,attachmentsValidator(),validationHandler,sendAttachments)


app.route("/:id").get(leaveMembersValidator(),validationHandler,getMessages).put(renameValidator(),validationHandler,renameGroup).delete(leaveMembersValidator(),validationHandler,deleteChat)

export default app;