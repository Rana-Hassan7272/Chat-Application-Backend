import { socketUserMap } from "../app.js";

export const getOtherMember = (members, userId) => {
    return members.find(member => member._id.toString() !== userId.toString());
  };
  
export const getSockets=(users=[])=>{
  return users.map(user=>socketUserMap.get(user.toString()))
}
export const getBase64 = (file) => {
  if (!file || !file.buffer || !file.mimetype) {
    throw new Error('Invalid file object');
  }
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
};
