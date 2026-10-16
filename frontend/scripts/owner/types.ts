export type Inquiry = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  service: string;
  message: string;
  requestedPlan?: {
    id: string;
    name: string;
    price: string;
    period: string;
    contentRevision: number;
  } | null;
  status: string;
  possibleDuplicate: boolean | number;
  createdAt: number;
  updatedAt: number;
  anonymizedAt: number | null;
  notification: {
    id: string;
    status: string;
    delivery_status: string | null;
    attempts: number;
    last_error: string | null;
  } | null;
};

export type PrivacyRequest = {
  id: string;
  name: string;
  email: string;
  requestType: string;
  message: string;
  status: string;
  createdAt: number;
  completedAt: number | null;
  completedBy: string | null;
  identityVerifiedAt: number | null;
  completionAction: string | null;
  completionNote: string | null;
};
