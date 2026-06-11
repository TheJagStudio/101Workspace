from django.urls import path

from supplychain.views.customer_behavior import CustomerChurnView, RMAAnalysisView
from supplychain.views.dashboard import DashboardView
from supplychain.views.financial import FinancialPLView, TaxComplianceView
from supplychain.views.inventory import DemandForecastView, DustyInventoryView, ShrinkageAuditView, ShrinkageProductDetailView
from supplychain.views.procurement import APAgingView, VendorScorecardView
from supplychain.views.sales_ar import ARRiskView, MarginPricingView, QuotationPipelineView
from supplychain.views.workforce import EditFrictionView, LaborAllocationView, SalesRepROIView

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="supplychain-dashboard"),
    path("dusty-inventory/", DustyInventoryView.as_view(), name="supplychain-dusty-inventory"),
    path("shrinkage-audit/product-detail/", ShrinkageProductDetailView.as_view(), name="supplychain-shrinkage-product-detail"),
    path("shrinkage-audit/", ShrinkageAuditView.as_view(), name="supplychain-shrinkage-audit"),
    path("demand-forecast/", DemandForecastView.as_view(), name="supplychain-demand-forecast"),
    path("vendor-scorecard/", VendorScorecardView.as_view(), name="supplychain-vendor-scorecard"),
    path("ap-aging/", APAgingView.as_view(), name="supplychain-ap-aging"),
    path("quotation-pipeline/", QuotationPipelineView.as_view(), name="supplychain-quotation-pipeline"),
    path("margin-pricing/", MarginPricingView.as_view(), name="supplychain-margin-pricing"),
    path("ar-risk/", ARRiskView.as_view(), name="supplychain-ar-risk"),
    path("financial-pl/", FinancialPLView.as_view(), name="supplychain-financial-pl"),
    path("tax-compliance/", TaxComplianceView.as_view(), name="supplychain-tax-compliance"),
    path("sales-rep-roi/", SalesRepROIView.as_view(), name="supplychain-sales-rep-roi"),
    path("labor-allocation/", LaborAllocationView.as_view(), name="supplychain-labor-allocation"),
    path("edit-friction/", EditFrictionView.as_view(), name="supplychain-edit-friction"),
    path("rma-analysis/", RMAAnalysisView.as_view(), name="supplychain-rma-analysis"),
    path("customer-churn/", CustomerChurnView.as_view(), name="supplychain-customer-churn"),
]
