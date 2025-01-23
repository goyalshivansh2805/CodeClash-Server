import { Request } from "express";



interface CustomRequest extends Request {
  user?:{
    id?:string,
    version?:number
  }
};


export default CustomRequest;