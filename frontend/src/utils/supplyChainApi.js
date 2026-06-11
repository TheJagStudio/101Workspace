import { apiRequest } from "./api";

const BASE = () => `${import.meta.env.VITE_SERVER_URL}/api/supplychain`;

const qs = (params) => {
	const entries = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== "");
	return entries.length ? `?${new URLSearchParams(entries).toString()}` : "";
};

export const fetchDashboard = () => apiRequest(`${BASE()}/dashboard/`);

export const fetchDustyInventory = (params) => apiRequest(`${BASE()}/dusty-inventory/${qs(params)}`);

export const fetchShrinkageAudit = (params) => apiRequest(`${BASE()}/shrinkage-audit/${qs(params)}`);

export const fetchShrinkageProductDetail = (params) =>
	apiRequest(`${BASE()}/shrinkage-audit/${qs({ ...params, detail: true })}`);

export const fetchDemandForecast = (params) => apiRequest(`${BASE()}/demand-forecast/${qs(params)}`);

export const fetchVendorScorecard = (params) => apiRequest(`${BASE()}/vendor-scorecard/${qs(params)}`);

export const fetchAPAging = (params) => apiRequest(`${BASE()}/ap-aging/${qs(params)}`);

export const fetchQuotationPipeline = (params) => apiRequest(`${BASE()}/quotation-pipeline/${qs(params)}`);

export const fetchMarginPricing = (params) => apiRequest(`${BASE()}/margin-pricing/${qs(params)}`);

export const fetchARRisk = (params) => apiRequest(`${BASE()}/ar-risk/${qs(params)}`);

export const fetchFinancialPL = (params) => apiRequest(`${BASE()}/financial-pl/${qs(params)}`);

export const fetchTaxCompliance = (params) => apiRequest(`${BASE()}/tax-compliance/${qs(params)}`);

export const fetchSalesRepROI = (params) => apiRequest(`${BASE()}/sales-rep-roi/${qs(params)}`);

export const fetchLaborAllocation = (params) => apiRequest(`${BASE()}/labor-allocation/${qs(params)}`);

export const fetchEditFriction = (params) => apiRequest(`${BASE()}/edit-friction/${qs(params)}`);

export const fetchRMAAnalysis = (params) => apiRequest(`${BASE()}/rma-analysis/${qs(params)}`);

export const fetchCustomerChurn = (params) => apiRequest(`${BASE()}/customer-churn/${qs(params)}`);

export const postCustomerChurnFilter = (body) =>
	apiRequest(`${BASE()}/customer-churn/`, { method: "POST", body: JSON.stringify(body) });
