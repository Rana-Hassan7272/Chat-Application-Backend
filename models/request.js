import mongoose, {Schema,model,Types} from 'mongoose';
import { type } from 'os';
import { StringDecoder } from 'string_decoder';
const schema=new Schema({
  status:{
    type:String,
    default:"pending",
    enum:["pending","accepted","rejected"]
    
  }
    ,
  receiver:{
    type:Types.ObjectId,
    ref:'User',
    required:true


  },
  sender:{
    type:Types.ObjectId,
    ref:'User',
    required:true
  }
},{
    timestamps:true
})
export const Request=mongoose.models.request || model("Request",schema);