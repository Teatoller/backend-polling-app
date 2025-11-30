// src/types/twilio.ts
export interface SMSResponse {
  sid: string;
  status: string;
  to: string;
  from: string;
  body: string;
  dateCreated: Date;
}

export interface SMSError {
  code: number;
  message: string;
  moreInfo?: string;
  status: number;
}