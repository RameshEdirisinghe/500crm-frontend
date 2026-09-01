import { callLogRepository } from '../repositories';
import { ContactStatus, User, Customer, CallLog, DeliveryMethod } from '../models/domain';
import apiClient from '../lib/apiClient';

export interface SubmitCallResultInput {
  contactId: string;
  status: ContactStatus;
  direction?: 'OUTBOUND' | 'INBOUND';
  customerName?: string;
  customerAddress?: string;
  city?: string;
  secondaryMobile?: string;
  customerEmail?: string;
  deliveryMethod?: DeliveryMethod;
  deliveryNote?: string;
  selectedPackage?: 'ADULT' | 'KIDS' | 'BOTH' | 'NONE' | string;
  adultQty?: number;
  adultUnitPrice?: number;
  adultSubtotal?: number;
  kidsQty?: number;
  kidsUnitPrice?: number;
  kidsSubtotal?: number;
  items?: {
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
  }[];
  totalPackageValue?: number;
  codAmount?: number;
  remarks?: string;
  callDurationSeconds?: number;
  isFollowUp?: boolean;
}

export class CallLogService {
  static async submitCallResult(
    input: SubmitCallResultInput,
    member: User
  ): Promise<{ callLog: CallLog; customer: Customer | null }> {
    if (!member.teamId) {
      throw new Error('You must belong to a team before submitting call results.');
    }

    // Derive package details from items if provided for backward compatibility
    let adultQty = input.adultQty;
    let adultUnitPrice = input.adultUnitPrice;
    let adultSubtotal = input.adultSubtotal;
    let kidsQty = input.kidsQty;
    let kidsUnitPrice = input.kidsUnitPrice;
    let kidsSubtotal = input.kidsSubtotal;
    let selectedPackage = input.selectedPackage;

    if (input.items && input.items.length > 0) {
      const adultItem = input.items.find((i) => /adult/i.test(i.productName));
      const kidsItem = input.items.find((i) => /kid|child/i.test(i.productName));

      if (adultItem) {
        adultQty = adultQty ?? adultItem.quantity;
        adultUnitPrice = adultUnitPrice ?? adultItem.unitPrice;
        adultSubtotal = adultSubtotal ?? adultItem.subtotal;
      }
      if (kidsItem) {
        kidsQty = kidsQty ?? kidsItem.quantity;
        kidsUnitPrice = kidsUnitPrice ?? kidsItem.unitPrice;
        kidsSubtotal = kidsSubtotal ?? kidsItem.subtotal;
      }

      if (!selectedPackage) {
        if ((adultQty || 0) > 0 && (kidsQty || 0) > 0) {
          selectedPackage = 'BOTH';
        } else if ((adultQty || 0) > 0) {
          selectedPackage = 'ADULT';
        } else if ((kidsQty || 0) > 0) {
          selectedPackage = 'KIDS';
        } else {
          selectedPackage = 'NONE';
        }
      }
    }

    const payload: SubmitCallResultInput = {
      ...input,
      selectedPackage: selectedPackage || (input.status === 'INTERESTED' ? 'ADULT' : undefined),
      adultQty,
      adultUnitPrice,
      adultSubtotal,
      kidsQty,
      kidsUnitPrice,
      kidsSubtotal,
    };

    try {
      const response = await apiClient.post<{
        data: { callLog: CallLog; customer: Customer | null };
      }>('/call-logs/submit-result', payload);
      return response.data.data;
    } catch (err: any) {
      const resData = err?.response?.data;
      const errorsList: string[] = Array.isArray(resData?.errors)
        ? resData.errors
        : Array.isArray(resData?.message)
        ? resData.message
        : [];

      const isItemsRejected =
        errorsList.some((e: string) => typeof e === 'string' && e.toLowerCase().includes('items')) ||
        (typeof resData?.message === 'string' && resData.message.toLowerCase().includes('items'));

      // If backend doesn't support `items` in DTO, automatically strip it and retry with legacy package fields
      if (isItemsRejected && payload.items) {
        const { items: _omitted, ...legacyPayload } = payload;
        try {
          const retryResponse = await apiClient.post<{
            data: { callLog: CallLog; customer: Customer | null };
          }>('/call-logs/submit-result', legacyPayload);
          return retryResponse.data.data;
        } catch (retryErr: any) {
          const retryData = retryErr?.response?.data;
          const retryMsg =
            (Array.isArray(retryData?.errors) && retryData.errors[0]) ||
            (Array.isArray(retryData?.message) && retryData.message[0]) ||
            retryData?.message ||
            retryErr?.message ||
            'Failed to record call result.';
          throw new Error(retryMsg);
        }
      }

      const message =
        (Array.isArray(resData?.errors) && resData.errors[0]) ||
        (Array.isArray(resData?.message) && resData.message[0]) ||
        resData?.message ||
        err?.message ||
        'Failed to record call result.';
      throw new Error(message);
    }
  }

  static async getCallLogsByMember(memberId: string): Promise<CallLog[]> {
    return callLogRepository.getByMemberId(memberId);
  }

  static async getCallLogsByTeam(teamId: string): Promise<CallLog[]> {
    return callLogRepository.getByTeamId(teamId);
  }
}

