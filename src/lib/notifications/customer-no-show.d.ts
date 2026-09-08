export const CUSTOMER_NO_SHOW_PARENT_EVENT: "customer_no_show_parent";
export const CUSTOMER_NO_SHOW_GUIDE_EVENT: "customer_no_show_guide";
export const CUSTOMER_NO_SHOW_PARENT_DEDUPE_PREFIX: "customer-no-show-parent:";
export const CUSTOMER_NO_SHOW_GUIDE_DEDUPE_PREFIX: "customer-no-show-guide:";
export const CUSTOMER_NO_SHOW_PARENT_CTA_PATH: "/dashboard/student/study-halls";
export const CUSTOMER_NO_SHOW_GUIDE_CTA_PATH: "/dashboard/tutor/study-halls";

export function customerNoShowParentDedupeKey(bookingId: string): string;
export function customerNoShowGuideDedupeKey(bookingId: string): string;

export function shouldNotifyCustomerNoShow(rpcResult: unknown): boolean;
export function shouldNotifyCustomerNoShowAfterRpc(rpc: unknown): boolean;
