import mongoose, {Schema,model,Types} from 'mongoose';

const schema=new Schema({
  content:{
    type:String,
    
  },
  attachments:[{
    public_id:{
        type:String,
      
    },
    url:{
        type:String,
        
    }
  }],
  chat:{
    type:Types.ObjectId,
    ref:'Chat',
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

export const Message=mongoose.models.message || model("Message",schema);