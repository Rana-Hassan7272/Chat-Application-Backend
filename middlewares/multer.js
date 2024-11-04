import multer from 'multer'

const multerUpload=multer({
    limits:{
        fileSize:1024*1024*5,
    },
});
const singleFile=multerUpload.single("avatar");
const files=multerUpload.array("files",5)

export {singleFile,files}