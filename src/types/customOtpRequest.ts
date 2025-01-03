import { Request } from "express";

interface CustomOtpRequest extends Request {
  type?: string;
}

export default CustomOtpRequest;