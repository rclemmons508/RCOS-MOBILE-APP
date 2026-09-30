import { DepartmentTransfer } from '../types';

export const RCOS_DEPARTMENTS: DepartmentTransfer[] = [
  {
    id: 'dept-dispatch',
    name: 'Dispatch & Field Operations',
    extension: '101',
    leadName: 'Marcus Vance',
    realPhoneNumber: '+1 (555) 392-8811',
    description: 'Emergency dispatches, urgent technician deployment, on-site arrival ETA',
    status: 'available'
  },
  {
    id: 'dept-billing',
    name: 'Billing & Invoicing',
    extension: '102',
    leadName: 'Elena Rostova',
    realPhoneNumber: '+1 (555) 741-2290',
    description: 'Contract billing, invoices, payment processing, statement inquiries',
    status: 'available'
  },
  {
    id: 'dept-emergency',
    name: 'Emergency Mechanical & Electrical',
    extension: '103',
    leadName: 'Dave Miller',
    realPhoneNumber: '+1 (555) 883-1120',
    description: 'Active refrigerant leaks, power failure, critical breaker trips, flood/fire hazards',
    status: 'available'
  },
  {
    id: 'dept-sales',
    name: 'Sales & Project Estimates',
    extension: '104',
    leadName: 'Sarah Chen',
    realPhoneNumber: '+1 (555) 612-4490',
    description: 'New service contracts, facility automation retrofit quotes, capital planning',
    status: 'available'
  },
  {
    id: 'dept-accounts',
    name: 'Customer Accounts & Support',
    extension: '105',
    leadName: 'Alex Rivera',
    realPhoneNumber: '+1 (555) 902-3310',
    description: 'Client account management, recurring preventative maintenance schedules',
    status: 'available'
  }
];
